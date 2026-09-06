import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export const MAX_UPLOAD_PHOTOS = 10;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per photo

/**
 * Every reference image sent to Veo/Gemini is declared as `image/jpeg`
 * (see imageFromBuffer() in veo.ts) regardless of the source file's real
 * format, so an uploaded PNG/WEBP/HEIC must actually be re-encoded to real
 * JPEG bytes — not just renamed — or the provider will reject/misread it.
 * ffmpeg is already a hard runtime dependency of this app (used throughout
 * capture.ts and veo.ts), so it's reused here instead of adding a new image
 * library. This also caps dimensions to keep upload payloads reasonable,
 * matching the size discipline already used for website screenshots.
 */
export async function normalizeUploadToJpeg(input: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-'));
  const inputPath = path.join(dir, 'in');
  const outputPath = path.join(dir, 'out.jpg');
  try {
    await fs.writeFile(inputPath, input);
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', inputPath,
      '-vf', "scale='min(2400,iw)':'min(2400,ih)':force_original_aspect_ratio=decrease",
      '-frames:v', '1', '-q:v', '3', outputPath,
    ], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    return await fs.readFile(outputPath);
  } catch {
    throw new Error('That file could not be read as an image. Please upload JPEG, PNG, or WEBP photos.');
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function sanitizeUploadTitle(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Your uploaded photos';
  return trimmed.slice(0, 120);
}

export function uploadPhotoLabel(index: number, originalName?: string): string {
  const base = originalName ? originalName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() : '';
  return base ? `Uploaded photo: ${base}` : `Uploaded photo ${index + 1}`;
}
