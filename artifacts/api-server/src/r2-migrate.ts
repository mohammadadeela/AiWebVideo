import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isR2Configured, r2ObjectExists, uploadFileToR2 } from './lib/r2-storage.js';

const ASSETS_DIR = process.env.ASSETS_DIR ?? '/tmp/aiwebvideo-assets';
const VALID_JOB = /^(?:marketing|[0-9a-f-]{36})$/i;
const VALID_FILE = /^[a-z0-9][a-z0-9._-]{0,180}$/i;
const TEMPORARY_FILE = /^(?:ai-scene-\d+-(?:gemini|normalized)\.mp4|ai-scenes\.concat\.txt|ai-video-master-source\.mp4|ai-video-continuous-provider\.mp4|ai-video-continuous-master\.mp4|ai-video-audio-mix\.mp4|music-only-bed\.m4a|brand-name\.txt|narration-.+\.wav|.+-provider\.png)$/i;
const CONCURRENCY = 5;

async function collectAssets() {
  const output: Array<{ jobId: string; filename: string; filePath: string }> = [];
  let jobEntries: import('node:fs').Dirent[] = [];
  try {
    jobEntries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return output;
    throw error;
  }
  for (const jobEntry of jobEntries) {
    if (!jobEntry.isDirectory() || !VALID_JOB.test(jobEntry.name)) continue;
    const directory = path.join(ASSETS_DIR, jobEntry.name);
    const files = await fs.readdir(directory, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !VALID_FILE.test(file.name) || TEMPORARY_FILE.test(file.name)) continue;
      output.push({ jobId: jobEntry.name, filename: file.name, filePath: path.join(directory, file.name) });
    }
  }
  return output;
}

async function main() {
  if (!isR2Configured()) throw new Error('Cloudflare R2 is not configured. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  await fs.mkdir(ASSETS_DIR, { recursive: true });

  const assets = await collectAssets();
  console.log(`[r2-migrate] Checking ${assets.length} existing local asset${assets.length === 1 ? '' : 's'} for R2 backfill.`);
  let uploaded = 0;
  let skipped = 0;
  let cursor = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, assets.length)) }, async () => {
    while (cursor < assets.length) {
      const item = assets[cursor++];
      if (await r2ObjectExists(item.jobId, item.filename)) {
        skipped++;
        continue;
      }
      await uploadFileToR2(item.jobId, item.filename, item.filePath);
      uploaded++;
      if (uploaded % 25 === 0) console.log(`[r2-migrate] Uploaded ${uploaded} assets...`);
    }
  });
  await Promise.all(workers);
  console.log(`[r2-migrate] Complete. Uploaded ${uploaded}; already present ${skipped}.`);
}

main().catch((error) => {
  console.error(`[r2-migrate] FAILED: ${(error as Error).message}`);
  process.exitCode = 1;
});
