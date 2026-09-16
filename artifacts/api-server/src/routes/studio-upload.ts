import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { Router, raw } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { ASSETS_DIR } from '../lib/capture.js';
import { signPrivateAssetUrl } from '../lib/asset-access.js';
import { query } from '../lib/pool.js';
import {
  inspectStudioMedia,
  persistStudioUpload,
  safeStudioName,
  studioAssetKind,
  studioMimeSupported,
  verifyStudioFileMagic,
} from '../lib/studio-media.js';

const router = Router();
const CHUNK_DIR = path.join(ASSETS_DIR, '.studio-chunks');
const CHUNK_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_UPLOAD_BYTES = Math.max(
  100 * 1024 * 1024,
  Math.min(20 * 1024 * 1024 * 1024, Number(process.env.STUDIO_LARGE_UPLOAD_MAX_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES)),
);

fsSync.mkdirSync(CHUNK_DIR, { recursive: true });

interface UploadMeta {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface StudioAssetRow {
  id: string;
  project_id: string;
  user_id: string;
  source_job_id: string | null;
  kind: 'video' | 'image' | 'audio' | 'logo' | 'generated' | 'screenshot';
  name: string;
  mime_type: string;
  storage_url: string;
  source_url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: string | number | null;
  size_bytes: string | number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function metaPath(uploadId: string) {
  return path.join(CHUNK_DIR, `${uploadId}.json`);
}

function partPath(uploadId: string) {
  return path.join(CHUNK_DIR, `${uploadId}.part`);
}

function safeUploadId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function ownedProject(userId: string, projectId: string) {
  const result = await query<{ id: string }>(
    `SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

async function readMeta(uploadId: string) {
  try {
    return JSON.parse(await fs.readFile(metaPath(uploadId), 'utf8')) as UploadMeta;
  } catch {
    return null;
  }
}

async function cleanup(uploadId: string) {
  await Promise.all([
    fs.rm(metaPath(uploadId), { force: true }),
    fs.rm(partPath(uploadId), { force: true }),
  ]);
}

function signedAsset<T extends StudioAssetRow>(asset: T) {
  return {
    ...asset,
    storage_url: signPrivateAssetUrl(asset.storage_url),
    source_url: asset.source_url ? signPrivateAssetUrl(asset.source_url) : null,
  };
}

router.use(requireAuth);

router.post('/projects/:projectId/init', async (req, res) => {
  const projectId = String(req.params.projectId);
  if (!(await ownedProject(req.user!.id, projectId))) {
    res.status(404).json({ error: 'Studio project not found.' });
    return;
  }

  const parsed = z.object({
    name: z.string().trim().min(1).max(220),
    mimeType: z.string().trim().min(1).max(120),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  }).safeParse(req.body ?? {});

  if (!parsed.success || !studioMimeSupported(parsed.success ? parsed.data.mimeType : '')) {
    res.status(400).json({ error: 'Unsupported or invalid Studio media file.' });
    return;
  }

  const uploadId = randomUUID();
  const meta: UploadMeta = {
    id: uploadId,
    userId: req.user!.id,
    projectId,
    name: safeStudioName(parsed.data.name),
    mimeType: parsed.data.mimeType,
    size: parsed.data.size,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(metaPath(uploadId), JSON.stringify(meta), { flag: 'wx', mode: 0o600 });
  await fs.writeFile(partPath(uploadId), Buffer.alloc(0), { flag: 'wx', mode: 0o600 });

  res.status(201).json({
    uploadId,
    chunkBytes: CHUNK_BYTES,
    maxBytes: MAX_UPLOAD_BYTES,
    receivedBytes: 0,
  });
});

router.put(
  '/projects/:projectId/:uploadId/chunk',
  raw({ type: 'application/octet-stream', limit: CHUNK_BYTES + 1024 }),
  async (req, res) => {
    const uploadId = safeUploadId(String(req.params.uploadId));
    if (!uploadId) {
      res.status(400).json({ error: 'Invalid upload id.' });
      return;
    }
    const meta = await readMeta(uploadId);
    if (!meta || meta.userId !== req.user!.id || meta.projectId !== String(req.params.projectId)) {
      res.status(404).json({ error: 'Upload session not found.' });
      return;
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length || body.length > CHUNK_BYTES) {
      res.status(400).json({ error: 'Invalid upload chunk.' });
      return;
    }

    const requestedOffset = Number(req.query.offset ?? -1);
    const stat = await fs.stat(partPath(uploadId));
    if (!Number.isFinite(requestedOffset) || requestedOffset !== stat.size) {
      res.status(409).json({ error: 'Upload offset changed. Resume from the server offset.', receivedBytes: stat.size });
      return;
    }
    if (stat.size + body.length > meta.size) {
      res.status(400).json({ error: 'Upload exceeds the declared file size.' });
      return;
    }

    await fs.appendFile(partPath(uploadId), body);
    res.json({ receivedBytes: stat.size + body.length, totalBytes: meta.size });
  },
);

router.post('/projects/:projectId/:uploadId/complete', async (req, res) => {
  const uploadId = safeUploadId(String(req.params.uploadId));
  if (!uploadId) {
    res.status(400).json({ error: 'Invalid upload id.' });
    return;
  }

  const meta = await readMeta(uploadId);
  if (!meta || meta.userId !== req.user!.id || meta.projectId !== String(req.params.projectId)) {
    res.status(404).json({ error: 'Upload session not found.' });
    return;
  }

  if (!(await ownedProject(req.user!.id, meta.projectId))) {
    await cleanup(uploadId);
    res.status(404).json({ error: 'Studio project not found.' });
    return;
  }

  try {
    const stat = await fs.stat(partPath(uploadId));
    if (stat.size !== meta.size) {
      res.status(409).json({ error: 'Upload is incomplete.', receivedBytes: stat.size, totalBytes: meta.size });
      return;
    }
    if (!(await verifyStudioFileMagic(partPath(uploadId), meta.mimeType))) {
      throw new Error(`${meta.name} does not match its declared file type.`);
    }

    const persisted = await persistStudioUpload(meta.projectId, partPath(uploadId), meta.mimeType);
    const info = await inspectStudioMedia(persisted.filePath);
    const result = await query<StudioAssetRow>(
      `INSERT INTO studio_assets (project_id,user_id,kind,name,mime_type,storage_url,width,height,duration_seconds,size_bytes,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`,
      [
        meta.projectId,
        req.user!.id,
        studioAssetKind(meta.mimeType, meta.name),
        meta.name,
        meta.mimeType,
        persisted.storageUrl,
        info.width,
        info.height,
        info.durationSeconds,
        stat.size,
        JSON.stringify({ chunkedUpload: true }),
      ],
    );
    await fs.rm(metaPath(uploadId), { force: true });
    res.status(201).json({ asset: signedAsset(result.rows[0]) });
  } catch (error) {
    await cleanup(uploadId);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not finish Studio upload.' });
  }
});

router.delete('/projects/:projectId/:uploadId', async (req, res) => {
  const uploadId = safeUploadId(String(req.params.uploadId));
  if (!uploadId) {
    res.status(400).json({ error: 'Invalid upload id.' });
    return;
  }
  const meta = await readMeta(uploadId);
  if (!meta || meta.userId !== req.user!.id || meta.projectId !== String(req.params.projectId)) {
    res.status(404).json({ error: 'Upload session not found.' });
    return;
  }
  await cleanup(uploadId);
  res.status(204).end();
});

export default router;
