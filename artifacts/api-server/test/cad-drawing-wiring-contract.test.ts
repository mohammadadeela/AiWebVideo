import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { composeStudioBrief } from '../src/lib/studio-direction.js';
import { drawingBrief, readDrawing } from '../src/lib/cad-drawing.js';
import { readFileSync } from 'node:fs';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const be = (file: string) => readFile(path.resolve(process.cwd(), 'src', file), 'utf8');

test('the measured figures reach the AI for Interior and Architecture, right after the master direction, and never for other kinds', () => {
  const brief = drawingBrief(readDrawing(readFileSync(path.resolve(process.cwd(), 'test/fixtures/house_mm.dxf')), 'house_mm.dxf').facts);
  for (const kind of ['architecture', 'interior'] as const) {
    const directed = composeStudioBrief({ studioKind: kind, userBrief: 'Modern villa', architecture: kind === 'architecture' ? { location: 'Ramallah' } : null, drawingBrief: brief });
    assert.ok(directed.includes('MEASURED DRAWING DATA'), kind);
    assert.ok(directed.indexOf('MEASURED DRAWING DATA') < directed.indexOf('Modern villa'), 'the customer\'s own words still come last and win');
  }
  assert.ok(!composeStudioBrief({ studioKind: 'product', userBrief: 'x', drawingBrief: brief }).includes('MEASURED DRAWING DATA'));
  assert.ok(!composeStudioBrief({ studioKind: 'architecture', userBrief: 'x', architecture: { location: 'a' } }).includes('MEASURED DRAWING DATA'));
});

test('the upload route reads the drawing before a job exists, holds unconfirmed units back, and only allows Interior and Architecture', async () => {
  const route = await be('routes/uploads.ts');
  assert.match(route, /\{ name: 'drawing', maxCount: 1 \}/);
  assert.match(route, /\\\.\(dxf\|dwg\)\$/);                                             // recognised by extension, then really parsed
  assert.ok(route.indexOf('readDrawing(drawingFile.buffer') < route.indexOf('await createUploadJob('), 'a bad file never leaves half a production behind');
  assert.match(route, /drawing\.facts\.units\.needsConfirmation/);
  assert.match(route, /DRAWING_UNITS_UNCONFIRMED/);
  assert.match(route, /studioKind !== 'interior' && studioKind !== 'architecture'/);
  assert.match(route, /file\.size > MAX_UPLOAD_BYTES/);                                  // photos keep their own 10 MB limit
  assert.match(route, /url: `drawing:\/\/\$\{job\.id\}`/);                               // the plan picture is a reference of the job
  assert.match(route, /brief: drawingBrief\(drawing\.facts\)/);
  const jobs = await be('routes/jobs.ts');
  assert.match(jobs, /drawingBrief: meta\?\.drawing\?\.brief \?\? null/);
});

test('the customer checks the drawing first: Generate is held until it is read and its units are confirmed, and what they saw is what is sent', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /drawingAttachment\.blockReason/);
  assert.match(form, /drawingUnits: cadMode \? drawingAttachment\.drawing\?\.preview\?\.units\.choice : undefined/);
  assert.match(form, /accept="\.dxf,\.dwg"/);
  assert.match(form, /onPickDrawing=\{cadMode \?/);                                      // only Interior and Architecture offer it
  assert.match(form, /useEffect\(\(\) => \{ if \(!cadMode\) drawingAttachment\.remove\(\); \}/);
  const card = await fe('components/chat/DrawingCard.tsx');
  assert.match(card, /Which units does this drawing use\?/);
  assert.match(card, /role="radiogroup"/);
  assert.match(card, /preview\.units\.needsConfirmation/);
  const menu = await fe('components/chat/ComposerPlusMenu.tsx');
  assert.match(menu, /Add CAD drawing/);
});

test('a drawing attached before signing in survives the sign-in hand-off', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /request\.drawing \? \[\.\.\.request\.files, request\.drawing\] : request\.files/);
  assert.match(widget, /drawingUnits: request\.drawingUnits,\s*\},\s*attachmentDraftKey/);
  assert.match(widget, /drawing: waiting\.files\.find\(\(file\) => isDrawingFile\(file\)\)/);
  assert.match(widget, /drawing: request\.drawing,\s*drawingUnits: request\.drawingUnits,/);
  const client = await fe('lib/api-client.ts');
  assert.match(client, /form\.append\('drawing', opts\.drawing\)/);
  assert.match(client, /\/api\/uploads\/drawing-preview/);
});
