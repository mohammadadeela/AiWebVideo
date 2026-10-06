import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { ASSETS_DIR } from './capture.js';

const execFileAsync = promisify(execFile);

/**
 * Small copies of a finished picture or video frame, so the page can show something the moment it is asked to:
 *  - 32 px wide: a few hundred bytes, shown blurred while the real picture loads (no empty box, no jump);
 *  - 480 / 960 px: what a grid tile or a phone actually needs (a 4K master is several MB);
 *  - a poster frame for a video, so the player shows the picture before any video data has arrived.
 * They are made once, kept next to the original, and only ever served for files that exist on this server.
 * The original is never changed and stays what "download" and "full size" use.
 */
export const IMAGE_VARIANT_WIDTHS = [32, 480, 960] as const;
export type ImageVariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

const IMAGE_FILE = /\.(?:png|jpe?g|webp)$/i;
const VIDEO_FILE = /\.(?:mp4|webm|mov|m4v)$/i;
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,180}$/i;
const POSTER_WIDTH = 960;

export function parseVariantWidth(value: unknown): ImageVariantWidth | null {
  if (typeof value !== 'string' || !/^\d{2,4}$/.test(value)) return null;
  const width = Number(value);
  return (IMAGE_VARIANT_WIDTHS as readonly number[]).includes(width) ? (width as ImageVariantWidth) : null;
}

export const isImageName = (name: string) => IMAGE_FILE.test(name);
export const isVideoName = (name: string) => VIDEO_FILE.test(name);

const variantDir = (jobId: string) => path.join(ASSETS_DIR, jobId, '.variants');
export const variantFileName = (name: string, width: number | 'poster') => `${path.basename(name)}.${width === 'poster' ? 'poster' : `w${width}`}.jpg`;

const inFlight = new Map<string, Promise<string | null>>();

async function exists(file: string) {
  try { return (await fs.stat(file)).size > 0; } catch { return false; }
}

async function make(jobId: string, name: string, width: number | 'poster'): Promise<string | null> {
  if (!SAFE_NAME.test(name)) return null;
  const source = path.join(ASSETS_DIR, jobId, name);
  const output = path.join(variantDir(jobId), variantFileName(name, width));
  if (await exists(output)) return output;
  if (!(await exists(source))) return null;
  const isPoster = width === 'poster';
  if (isPoster ? !isVideoName(name) : !isImageName(name)) return null;
  const key = output;
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      await fs.mkdir(variantDir(jobId), { recursive: true });
      const target = isPoster ? POSTER_WIDTH : width;
      const args = ['-y', '-hide_banner', '-loglevel', 'error'];
      // A short way in avoids a black first frame that many encoders produce.
      if (isPoster) args.push('-ss', '0.15');
      args.push('-i', source, '-vf', `scale='min(${target},iw)':-2:flags=lanczos`, '-frames:v', '1', '-q:v', target <= 32 ? '7' : '4', output);
      await execFileAsync('ffmpeg', args, { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
      return (await exists(output)) ? output : null;
    } catch {
      await fs.rm(output, { force: true }).catch(() => {});
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

export const ensureImageVariant = (jobId: string, name: string, width: ImageVariantWidth) => make(jobId, name, width);
export const ensureVideoPoster = (jobId: string, name: string) => make(jobId, name, 'poster');

/** Fire and forget right after a picture is finished, so the first visit already finds them. */
export function prepareImageVariants(jobId: string, name: string): void {
  for (const width of IMAGE_VARIANT_WIDTHS) void make(jobId, name, width).catch(() => {});
}
export function prepareVideoPoster(jobId: string, name: string): void {
  void make(jobId, name, 'poster').catch(() => {});
}
