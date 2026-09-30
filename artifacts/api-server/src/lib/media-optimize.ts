import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export interface OptimizedVideo {
  video: Buffer;
  poster: Buffer | null;
  extension: '.mp4' | '.webm' | '.mov';
  optimized: boolean;
}

/**
 * Makes an uploaded showcase video start instantly on phones.
 *
 * Most "the video only plays after a long time" reports come from files whose index (the moov atom)
 * sits at the END of the file, so a phone must download everything before it can show a frame, and
 * from HEVC/MOV files that Android cannot decode. This re-encodes to H.264 + yuv420p, moves the
 * index to the front (faststart), strips the unused audio track and caps the size at 1080p. It also
 * extracts a poster frame so something is on screen while the video loads.
 *
 * Any failure returns the original bytes so an upload is never lost.
 */
export async function optimizeShowcaseVideo(input: Buffer, originalExtension: '.mp4' | '.webm' | '.mov'): Promise<OptimizedVideo> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'showcase-'));
  const source = path.join(directory, `source${originalExtension}`);
  const output = path.join(directory, 'optimized.mp4');
  const posterPath = path.join(directory, 'poster.jpg');
  try {
    await fs.writeFile(source, input);
    await execFileAsync('ffmpeg', [
      '-y', '-i', source,
      '-an',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      // Cap the LONGER side at 1920 (1080x1920 portrait and 1920x1080 landscape both stay full size).
      '-vf', "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'",
      '-movflags', '+faststart',
      output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    const video = await fs.readFile(output);
    if (!video.length) throw new Error('empty output');

    let poster: Buffer | null = null;
    try {
      await execFileAsync('ffmpeg', ['-y', '-ss', '0.4', '-i', output, '-frames:v', '1', '-q:v', '3', posterPath], { timeout: 60_000 });
      poster = await fs.readFile(posterPath);
      if (!poster.length) poster = null;
    } catch {
      try {
        // Very short clips: fall back to the first frame.
        await execFileAsync('ffmpeg', ['-y', '-i', output, '-frames:v', '1', '-q:v', '3', posterPath], { timeout: 60_000 });
        poster = await fs.readFile(posterPath);
      } catch { poster = null; }
    }
    return { video, poster, extension: '.mp4', optimized: true };
  } catch (error) {
    console.warn(`[marketing] video optimization skipped: ${(error as Error).message}`);
    return { video: input, poster: null, extension: originalExtension, optimized: false };
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

/** True when the MP4 index is at the front of the file (playable while downloading). */
export function hasFastStart(buffer: Buffer): boolean {
  const moov = buffer.indexOf(Buffer.from('moov'));
  const mdat = buffer.indexOf(Buffer.from('mdat'));
  return moov !== -1 && (mdat === -1 || moov < mdat);
}
