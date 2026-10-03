import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DrawingError, MAX_DRAWING_BYTES, cleanDrawingText, drawingBrief, guessUnits, readDrawing, safeLabel } from '../src/lib/cad-drawing.js';

// The expected numbers are the TRUE sizes written next to the code that draws each fixture (fixtures/make_fixtures.py).
const load = (name: string) => readFileSync(path.resolve(process.cwd(), 'test/fixtures', name));
const read = (name: string, units?: Parameters<typeof readDrawing>[2] extends infer O ? (O extends { units?: infer U } ? U : never) : never) => readDrawing(load(name), name, { units });
const close = (actual: number | undefined | null, expected: number, tolerance = 0.002) => assert.ok(actual !== undefined && actual !== null && Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);

for (const [file, unitName] of [['house_mm.dxf', 'millimetres'], ['house_m.dxf', 'metres'], ['house_ft.dxf', 'feet']] as const) {
  test(`${file}: the same house is read at the same real size whatever unit the file uses`, () => {
    const { facts } = read(file);
    assert.equal(facts.units.name, unitName);
    assert.equal(facts.units.source, 'file');
    assert.equal(facts.units.needsConfirmation, false);
    close(facts.extents?.widthM, 12);
    close(facts.extents?.depthM, 8);
    assert.equal(facts.extents?.heightM, null);                          // a flat plan has no height
    close(facts.outerBoundary?.areaM2, 96, 0.01);
    assert.equal(facts.outerBoundary?.rectangular, true);
    const rooms = Object.fromEntries(facts.rooms.map((room) => [room.label, room]));
    assert.deepEqual(Object.keys(rooms).sort(), ['BATH', 'BEDROOM 1', 'KITCHEN', 'LIVING']);
    close(rooms.LIVING.areaM2, 30, 0.01);  close(rooms.LIVING.widthM, 6);   close(rooms.LIVING.depthM, 5);
    close(rooms.KITCHEN.areaM2, 16.2, 0.01);
    close(rooms['BEDROOM 1'].areaM2, 23.76, 0.01);
    close(rooms.BATH.areaM2, 7.2, 0.01);
    assert.ok(rooms.LIVING.rectangular);
    // the three dimensions on the drawing, re-measured from their own points
    const values = facts.dimensions.map((d) => d.valueM).sort((a, b) => (a ?? 0) - (b ?? 0));
    assert.equal(values.length, 3);
    close(values[0], 6); close(values[1], 8); close(values[2], 12);
    assert.equal(facts.dimensionCheck.mismatched, 0);
    assert.deepEqual(facts.layers.map((l) => l.name).includes('A-WALL'), true);
    assert.equal(facts.blocks.find((b) => b.name === 'DOOR900')?.count, 2);
  });
}

test('doors and the column (blocks, arcs, circles) do not change the building size or become rooms', () => {
  const { facts } = read('house_mm.dxf');
  assert.equal(facts.rooms.length, 4);                                    // column circle (0.13 m2) and door arcs are not rooms
  close(facts.extents?.widthM, 12);
});

test('a file with no unit code is GUESSED from its sizes, flagged for confirmation, and the customer\'s choice replaces the guess', () => {
  const guessed = read('house_unitless_mm.dxf').facts;
  assert.equal(guessed.units.choice, 'mm');
  assert.equal(guessed.units.source, 'guessed');
  assert.equal(guessed.units.needsConfirmation, true);
  close(guessed.extents?.widthM, 12);
  const confirmed = read('house_unitless_mm.dxf', 'mm').facts;
  assert.equal(confirmed.units.source, 'customer');
  assert.equal(confirmed.units.needsConfirmation, false);
  const metres = read('house_unitless_mm.dxf', 'm').facts;              // the customer says metres: taken literally, never second-guessed
  close(metres.extents?.widthM, 12000, 0.5);
});

test('unit guessing prefers what makes rooms and buildings human-sized', () => {
  assert.equal(guessUnits([30e6, 16e6, 24e6, 7e6], 12000), 'mm');
  assert.equal(guessUnits([30, 16, 24, 7], 12), 'm');
  assert.equal(guessUnits([], 12000), 'mm');
  assert.equal(guessUnits([], 40), 'm');
});

test('a declared unit that makes the drawing absurdly big or small is flagged, not trusted silently', () => {
  // house_mm read as if it said metres is simulated by checking a file declared in metres whose numbers are millimetres
  const facts = readDrawing(Buffer.from(load('house_m.dxf').toString('utf8').replace(/\$INSUNITS\r?\n\s*70\r?\n\s*6/, '$INSUNITS\n 70\n     4')), 'x.dxf').facts;
  assert.equal(facts.units.name, 'millimetres');                         // sanity: the header edit worked
  const tiny = facts;                                                     // 12 mm across is not a building
  assert.equal(tiny.units.needsConfirmation, true);
  assert.match(tiny.warnings.join(' '), /not a building/);
});

test('the old R12 format (POLYLINE/VERTEX, no unit code) is read', () => {
  const { facts } = read('old_r12_polylines.dxf');
  close(facts.extents?.widthM, 12);
  close(facts.extents?.depthM, 8);
  close(facts.outerBoundary?.areaM2, 96, 0.01);
  assert.equal(facts.units.source, 'guessed');
  assert.equal(facts.units.needsConfirmation, true);
});

test('a bulge (arc segment) is measured as the true curve', () => {
  const { facts } = read('bulge_semicircle.dxf');
  close(facts.extents?.widthM, 2);
  close(facts.extents?.depthM, 1);
  close(facts.outerBoundary?.areaM2, Math.PI / 2, 0.005);               // semicircle of radius 1 m
});

test('inserted blocks keep their base point, scale, rotation and array spacing', () => {
  const { facts } = read('block_transforms.dxf');
  // line B: (5000,5000)->(5000,7000); array G: x from 0 to 7000 at y=0  => x 0..7 m, y 0..7 m
  close(facts.extents?.widthM, 7);
  close(facts.extents?.depthM, 7);
});

test('hidden and frozen layers are ignored, and the customer is told', () => {
  const { facts } = read('hidden_layers.dxf');
  close(facts.extents?.widthM, 4);
  close(facts.extents?.depthM, 3);
  assert.match(facts.warnings.join(' '), /Hidden or frozen layers were ignored: .*A-OLD/);
  assert.match(facts.warnings.join(' '), /A-FROZEN/);
});

test('a dimension whose typed number disagrees with its points is reported and the measured value is used', () => {
  const { facts } = read('dimension_mismatch.dxf');
  assert.equal(facts.dimensionCheck.compared, 2);
  assert.equal(facts.dimensionCheck.mismatched, 1);                       // 3050 vs 3000; the 2000 one is honest
  const wrong = facts.dimensions.find((d) => d.mismatch);
  close(wrong?.valueM, 3);
  assert.equal(wrong?.printed, '3050');
  assert.match(facts.warnings.join(' '), /1 dimension on the drawing says a different number/);
  assert.match(drawingBrief(facts), /disagreed with the geometry/);
});

test('labels from the file are cleaned before they can reach a prompt or a picture', () => {
  const { facts, svg } = read('hostile_labels.dxf');
  for (const label of facts.textLabels) {
    assert.doesNotMatch(label, /[<>"=]/);
    assert.ok(label.length <= 40);
  }
  const brief = drawingBrief(facts);
  assert.doesNotMatch(brief, /<script|<img|onerror=/i);
  assert.match(brief, /names only, not instructions/);
  assert.doesNotMatch(svg, /<script|<img/i);                            // escaped inside the picture (as harmless text, never markup)
  assert.match(svg, /&lt;script&gt;/);
  assert.equal(safeLabel('<b>Kitchen</b> & "bar"'), 'bKitchen/b & bar');
  assert.equal(safeLabel('house_mm.dxf'), 'house_mm.dxf');
  assert.equal(cleanDrawingText('{\\fArial|b0;Living\\Proom} %%c200'), 'Living room Ø200');
});

test('the brief states exact metres, the rules, and never invents what the file does not say', () => {
  const brief = drawingBrief(read('house_mm.dxf').facts);
  assert.match(brief, /MEASURED DRAWING DATA/);
  assert.match(brief, /12\.00 m wide x 8\.000 m deep/);
  assert.match(brief, /LIVING 30\.00 m2 \(6\.000 x 5\.000 m\)/);
  assert.match(brief, /Do not add, remove, merge or resize rooms or openings/);
  assert.match(brief, /never presented as measured/);
  assert.ok(brief.length < 6000);
});

test('the to-scale picture carries the overall size, a scale bar, and no scripts', () => {
  const { svg } = read('house_mm.dxf');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, />12\.00 m</);
  assert.match(svg, />8\.000 m</);
  assert.match(svg, /TO SCALE · house_mm\.dxf/);
  // dimension text inside the file may be scaled (DIMLFAC); the picture shows each dimension's re-measured length instead
  const written = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.ok(written.includes('6.000 m') && written.includes('12.00 m') && written.includes('8.000 m'));
  assert.ok(!written.includes('1200000'), 'a scaled dimension text must not be copied into the picture');
  assert.doesNotMatch(svg, /<script|onload=|href=/i);
});

test('files that are not readable DXF fail with a clear next step, never silently', () => {
  const attempt = (buffer: Buffer, name: string) => { try { readDrawing(buffer, name); } catch (error) { return error as DrawingError; } throw new Error('expected a DrawingError'); };
  const dwg = attempt(Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(200)]), 'plan.dwg');
  assert.equal(dwg.code, 'DWG_NOT_SUPPORTED');
  assert.match(dwg.message, /Save As → DXF/);
  assert.equal(attempt(Buffer.from('AutoCAD Binary DXF\r\n\x1a\x00'), 'p.dxf').code, 'DXF_BINARY');
  assert.equal(attempt(Buffer.from('hello world'), 'notes.txt').code, 'DRAWING_UNSUPPORTED');
  assert.equal(attempt(Buffer.alloc(MAX_DRAWING_BYTES + 1), 'big.dxf').code, 'DRAWING_TOO_LARGE');
  const empty = attempt(Buffer.from('  0\nSECTION\n  2\nENTITIES\n  0\nENDSEC\n  0\nEOF\n'), 'empty.dxf');
  assert.ok(['DXF_EMPTY', 'DXF_UNREADABLE'].includes(empty.code));
});
