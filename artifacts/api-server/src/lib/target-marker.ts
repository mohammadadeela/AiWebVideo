import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { TargetKind } from './studio-direction.js';

const execFileAsync = promisify(execFile);

/**
 * A copy of a picture with a red-and-white box (and a small cross) where the customer pointed.
 *
 * The AI is given this next to the CLEAN picture, labelled as a locating aid. The box says WHERE; the customer's chosen
 * target (whole building, one shop, one floor, empty land) says WHAT. Its size follows what is being pointed at, but it is
 * only a pointer, never the exact outline of the thing.
 */
export const MARKER_BOX: Record<TargetKind, { w: number; h: number }> = {
  building: { w: 0.34, h: 0.4 },
  unit: { w: 0.2, h: 0.24 },
  floor: { w: 0.56, h: 0.13 },
  land: { w: 0.42, h: 0.16 },
};

const num = (value: number) => value.toFixed(4);

/** The ffmpeg filter chain, in fractions of the picture, so it works for any image size. */
export function markerFilter(point: { x: number; y: number }, kind: TargetKind): string {
  const x = Math.min(1, Math.max(0, point.x));
  const y = Math.min(1, Math.max(0, point.y));
  const { w, h } = MARKER_BOX[kind];
  // the box is centred on the tap and kept inside the picture ("\," is how a comma is written inside a filter expression)
  const bx = `max(0\\,min(iw*${num(x)}-iw*${num(w / 2)}\\,iw-iw*${num(w)}))`;
  const by = `max(0\\,min(ih*${num(y)}-ih*${num(h / 2)}\\,ih-ih*${num(h)}))`;
  const box = (color: string, thickness: string) => `drawbox=x=${bx}:y=${by}:w=iw*${num(w)}:h=ih*${num(h)}:color=${color}:t=${thickness}`;
  const cross = (cx: string, cy: string, cw: string, ch: string) => `drawbox=x=${cx}:y=${cy}:w=${cw}:h=${ch}:color=red@0.95:t=fill`;
  return [
    box('white@0.95', 'max(6\\,iw/110)'),
    box('red@0.95', 'max(3\\,iw/220)'),
    cross(`iw*${num(x)}-iw*0.02`, `ih*${num(y)}-1.5`, 'iw*0.04', '3'),
    cross(`iw*${num(x)}-1.5`, `ih*${num(y)}-ih*0.025`, '3', 'ih*0.05'),
  ].join(',');
}

/** Returns the marked copy, or null when ffmpeg cannot draw it (the production then continues without the marked copy). */
export async function drawTargetMarker(image: Buffer, point: { x: number; y: number }, kind: TargetKind): Promise<Buffer | null> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'marker-'));
  const input = path.join(dir, 'in');
  const output = path.join(dir, 'out.jpg');
  try {
    await fs.writeFile(input, image);
    await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-vf', markerFilter(point, kind), '-frames:v', '1', '-q:v', '3', output], { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 });
    return await fs.readFile(output);
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** The label the AI reads next to the marked copy. */
export function markerLabel(kind: TargetKind, source: 'street' | 'photo'): string {
  const what = { building: 'the whole building', unit: 'one shop or unit', floor: 'one floor', land: 'empty land' }[kind];
  return `TARGET MARKER — locating aid only. The red box shows where the customer pointed on ${source === 'photo' ? 'their own photo' : 'the first Street View picture'} (${what}). It is NOT part of the scene: never draw the box, the cross or any marker in any result, and never treat the box as the exact outline.`;
}
