import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ASSETS_DIR } from './capture.js';

const execFileAsync = promisify(execFile);
const WATERMARK_TEXT = (process.env.WATERMARK_TEXT ?? 'AiWebVideo').replace(/[:'\\]/g, '');

export function videoWatermarkFilter() {
  return `drawtext=text='${WATERMARK_TEXT}':fontcolor=white@0.82:fontsize=h/30:box=1:boxcolor=black@0.34:boxborderw=12:x=w-tw-28:y=h-th-24`;
}

export async function watermarkImage(jobId: string, filename: string) {
  const source = path.join(ASSETS_DIR, jobId, filename);
  const temporary = path.join(ASSETS_DIR, jobId, `.watermarked-${filename}`);
  await execFileAsync('ffmpeg', ['-y', '-i', source, '-vf', videoWatermarkFilter(), '-frames:v', '1', temporary], {
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  await fs.rename(temporary, source);
}
