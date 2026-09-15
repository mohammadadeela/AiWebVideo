import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { ASSETS_DIR } from './capture.js';
import { ensureLocalAsset, uploadFileToR2 } from './r2-storage.js';

const execFileAsync = promisify(execFile);
const LOCAL_ASSET_RE = /^\/api\/assets\/([0-9a-f-]{36})\/([a-z0-9][a-z0-9._-]{0,180})(?:\?.*)?$/i;

export const STUDIO_UPLOAD_MAX_BYTES = Math.max(10 * 1024 * 1024, Math.min(500 * 1024 * 1024, Number(process.env.STUDIO_UPLOAD_MAX_BYTES ?? 250 * 1024 * 1024)));

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
};

export function studioMimeSupported(mime: string) {
  return Boolean(MIME_EXTENSION[mime.toLowerCase()]);
}

export function extensionForStudioMime(mime: string) {
  return MIME_EXTENSION[mime.toLowerCase()] ?? '';
}

export function studioAssetKind(mime: string, originalName = ''): 'image' | 'video' | 'audio' | 'logo' {
  const lower = originalName.toLowerCase();
  if (/logo|mark|brand/.test(lower) && mime.startsWith('image/')) return 'logo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
}

export function safeStudioName(value: string) {
  return value.replace(/[\r\n\0]/g, '').replace(/[^a-z0-9._()\- ]/gi, '_').slice(0, 120) || 'media';
}

export async function verifyStudioFileMagic(filePath: string, mime: string) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, 16, 0);
    const head = buffer.subarray(0, bytesRead);
    const hex = head.toString('hex');
    const ascii = head.toString('ascii');
    if (mime === 'image/jpeg') return hex.startsWith('ffd8ff');
    if (mime === 'image/png') return hex.startsWith('89504e470d0a1a0a');
    if (mime === 'image/webp') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
    if (mime === 'video/webm') return hex.startsWith('1a45dfa3');
    if (mime === 'audio/mpeg') return ascii.startsWith('ID3') || ['fff1','fff2','fff3','fffb'].some((prefix) => hex.startsWith(prefix));
    if (mime === 'audio/wav' || mime === 'audio/x-wav') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE';
    if (mime === 'audio/ogg') return ascii.startsWith('OggS');
    if (mime === 'video/mp4' || mime === 'video/quicktime' || mime === 'audio/mp4') return ascii.slice(4, 8) === 'ftyp';
    return false;
  } finally {
    await handle.close();
  }
}

export async function inspectStudioMedia(filePath: string) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v','error','-print_format','json','-show_streams','-show_format',filePath,
    ], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
      format?: { duration?: string };
    };
    const video = parsed.streams?.find((item) => item.codec_type === 'video');
    const duration = Number(parsed.format?.duration ?? video?.duration ?? 0);
    return {
      width: Number(video?.width) || null,
      height: Number(video?.height) || null,
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
    };
  } catch {
    return { width: null, height: null, durationSeconds: null };
  }
}

export async function persistStudioUpload(projectId: string, temporaryPath: string, mime: string) {
  const extension = extensionForStudioMime(mime);
  if (!extension) throw new Error('Unsupported Studio media type.');
  const filename = `studio-${randomUUID()}${extension}`;
  const dir = path.join(ASSETS_DIR, projectId);
  await fs.mkdir(dir, { recursive: true });
  const destination = path.join(dir, filename);
  await fs.rename(temporaryPath, destination);
  await uploadFileToR2(projectId, filename, destination);
  return { filename, filePath: destination, storageUrl: `/api/assets/${projectId}/${filename}` };
}

export async function materializeStudioAsset(storageUrl: string) {
  const match = storageUrl.match(LOCAL_ASSET_RE);
  if (!match) throw new Error('Studio asset is not backed by private AiWebVideo storage.');
  const [, scopeId, filename] = match;
  const local = await ensureLocalAsset(scopeId, filename);
  if (!local) throw new Error('Studio asset is unavailable in storage.');
  return { scopeId, filename, filePath: local };
}

export async function removeTemporaryUpload(filePath?: string | null) {
  if (!filePath) return;
  await fs.rm(filePath, { force: true }).catch(() => {});
}
