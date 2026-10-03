import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import uploadsRouter from '../src/routes/uploads.js';

// The real router, over real HTTP and real multipart bodies, with the real reader behind it.
let server: Server;
let base = '';
before(async () => {
  const app = express();
  app.use('/api/uploads', uploadsRouter);
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/uploads`;
});
after(() => { server.close(); });

const fixture = (name: string) => readFileSync(path.resolve(process.cwd(), 'test/fixtures', name));
async function preview(name: string, bytes: Buffer, fields: Record<string, string> = {}, field = 'drawing') {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(bytes)]), name);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const res = await fetch(`${base}/drawing-preview`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() as Record<string, any> };
}

test('a DXF is read over HTTP: real sizes, rooms, units, and a picture to look at', async () => {
  const { status, body } = await preview('house_mm.dxf', fixture('house_mm.dxf'));
  assert.equal(status, 200);
  assert.equal(body.units.name, 'millimetres');
  assert.equal(body.units.needsConfirmation, false);
  assert.equal(body.extents.widthM, 12);
  assert.equal(body.extents.depthM, 8);
  assert.equal(body.outerBoundary.areaM2, 96);
  assert.equal(body.roomCount, 4);
  assert.equal(body.dimensionCount, 3);
  assert.match(body.previewSvg, /^<svg /);
});

test('a drawing without units comes back flagged, and the customer\'s choice is applied', async () => {
  const first = await preview('house_unitless_mm.dxf', fixture('house_unitless_mm.dxf'));
  assert.equal(first.body.units.needsConfirmation, true);
  assert.equal(first.body.units.source, 'guessed');
  const chosen = await preview('house_unitless_mm.dxf', fixture('house_unitless_mm.dxf'), { units: 'cm' });
  assert.equal(chosen.body.units.source, 'customer');
  assert.equal(chosen.body.units.needsConfirmation, false);
  assert.equal(chosen.body.extents.widthM, 120);                        // 12000 drawing units as centimetres
  const nonsense = await preview('house_unitless_mm.dxf', fixture('house_unitless_mm.dxf'), { units: 'parsecs' });
  assert.equal(nonsense.body.units.source, 'guessed');                  // an unknown unit is ignored, never trusted
});

test('a DWG, a non-drawing, an empty file and a wrong extension are refused with what to do next', async () => {
  const dwg = await preview('plan.dwg', Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(400)]));
  assert.equal(dwg.status, 422);
  assert.equal(dwg.body.code, 'DWG_NOT_SUPPORTED');
  assert.match(dwg.body.error, /Save As → DXF/);
  const text = await preview('notes.txt', Buffer.from('hello'));
  assert.equal(text.status, 400);
  assert.equal(text.body.code, 'UNSUPPORTED_FILE_TYPE');
  const empty = await preview('empty.dxf', Buffer.from('  0\nSECTION\n  2\nENTITIES\n  0\nENDSEC\n  0\nEOF\n'));
  assert.equal(empty.status, 422);
  const noFile = await fetch(`${base}/drawing-preview`, { method: 'POST', body: new FormData() });
  assert.equal(noFile.status, 400);
});

test('the preview is rate limited so reading drawings cannot be used to hog the server', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 14; i += 1) statuses.push((await preview('bulge_semicircle.dxf', fixture('bulge_semicircle.dxf'))).status);
  assert.ok(statuses.includes(429), `expected a 429 among ${statuses.join(',')}`);
});
