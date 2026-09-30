import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAdmin, requireAuth, tryAuth } from '../lib/auth.js';
import { ASSETS_DIR } from '../lib/capture.js';
import { signPrivateAssetUrl } from '../lib/asset-access.js';
import { pool, query } from '../lib/pool.js';
import {
  STUDIO_AI_PRICES,
  applyStudioCommands,
  emptyStudioProjectState,
  planStudioInstruction,
  studioProjectStateSchema,
  type PaidStudioOperation,
  type StudioProjectState,
} from '../lib/studio-engine.js';
import {
  STUDIO_UPLOAD_MAX_BYTES,
  inspectStudioMedia,
  materializeStudioAsset,
  persistStudioUpload,
  removeTemporaryUpload,
  safeStudioName,
  studioAssetKind,
  studioMimeSupported,
  verifyStudioFileMagic,
} from '../lib/studio-media.js';
import { runStudioImageOperation, StudioProviderError, type StudioReferenceImage } from '../lib/studio-image.js';
import { queueStudioExport } from '../lib/studio-renderer.js';

const router = Router();
const STUDIO_TMP_DIR = path.join(ASSETS_DIR, '.studio-uploads');
fsSync.mkdirSync(STUDIO_TMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: STUDIO_TMP_DIR,
    filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}.upload`),
  }),
  limits: { fileSize: STUDIO_UPLOAD_MAX_BYTES, files: 12 },
  fileFilter: (_req, file, callback) => {
    if (studioMimeSupported(file.mimetype)) callback(null, true);
    else callback(new Error(`Unsupported Studio media type: ${file.mimetype}`));
  },
});

interface StudioProjectRow {
  id: string;
  user_id: string;
  title: string;
  kind: 'video' | 'image';
  width: number;
  height: number;
  aspect_ratio: '16:9' | '9:16' | '1:1';
  duration_seconds: string | number;
  project_state: unknown;
  revision: number;
  latest_context: Record<string, unknown> | null;
  source_job_id: string | null;
  created_at: string;
  updated_at: string;
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

interface StudioOperationRow {
  id: string;
  project_id: string;
  user_id: string;
  operation_type: PaidStudioOperation | string;
  execution_kind: 'local' | 'paid';
  provider: string | null;
  model: string | null;
  commands: unknown;
  reserved_credits: number;
  final_credits: number;
  status: string;
  billing_job_id: string | null;
  output_asset_id: string | null;
  error: string | null;
  actual_cost_usd: string | number;
  created_at: string;
  updated_at: string;
}

function instructionHash(instruction: string) {
  return createHash('sha256').update(instruction.trim()).digest('hex');
}

function signedAsset<T extends StudioAssetRow>(asset: T) {
  return { ...asset, storage_url: signPrivateAssetUrl(asset.storage_url), source_url: asset.source_url ? signPrivateAssetUrl(asset.source_url) : null };
}

function projectPayload(row: StudioProjectRow) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    width: row.width,
    height: row.height,
    aspectRatio: row.aspect_ratio,
    durationSeconds: Number(row.duration_seconds || 0),
    projectState: row.project_state,
    revision: row.revision,
    sourceJobId: row.source_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ownedProject(userId: string, projectId: string) {
  const result = await query<StudioProjectRow>(
    `SELECT * FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

async function studioSettings() {
  const result = await query<{ value: Record<string, unknown> }>(`SELECT value FROM system_settings WHERE key='studio' LIMIT 1`);
  const value = result.rows[0]?.value ?? {};
  return value;
}

async function configuredPrice(operation: PaidStudioOperation) {
  const settings = await studioSettings();
  const prices = settings.prices && typeof settings.prices === 'object' ? settings.prices as Record<string, unknown> : {};
  const configured = Number(prices[operation]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : STUDIO_AI_PRICES[operation];
}

async function projectWithAssets(userId: string, projectId: string) {
  const project = await ownedProject(userId, projectId);
  if (!project) return null;
  const assets = await query<StudioAssetRow>('SELECT * FROM studio_assets WHERE project_id=$1 AND user_id=$2 ORDER BY created_at', [projectId, userId]);
  return { ...projectPayload(project), assets: assets.rows.map(signedAsset) };
}

async function saveRevision(client: import('pg').PoolClient, row: StudioProjectRow, state: StudioProjectState, label: string, latestContext?: Record<string, unknown>) {
  const nextRevision = row.revision + 1;
  await client.query(
    `UPDATE studio_projects
       SET project_state=$3::jsonb,
           revision=$4,
           latest_context=COALESCE($5::jsonb,latest_context),
           width=$6,
           height=$7,
           aspect_ratio=$8,
           duration_seconds=$9,
           updated_at=NOW()
     WHERE id=$1 AND user_id=$2`,
    [row.id, row.user_id, JSON.stringify(state), nextRevision, latestContext ? JSON.stringify(latestContext) : null, state.canvas.width, state.canvas.height, state.canvas.aspectRatio, state.duration],
  );
  await client.query(
    `INSERT INTO studio_revisions (project_id,user_id,revision,label,project_state) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [row.id, row.user_id, nextRevision, label.slice(0,160), JSON.stringify(state)],
  );
  return nextRevision;
}

function mimeForUrl(value: string) {
  const clean = value.split('?')[0].toLowerCase();
  if (clean.endsWith('.mp4')) return 'video/mp4';
  if (clean.endsWith('.webm')) return 'video/webm';
  if (clean.endsWith('.mov')) return 'video/quicktime';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  if (clean.endsWith('.m4a')) return 'audio/mp4';
  return 'application/octet-stream';
}

function nameForUrl(value: string) {
  return safeStudioName(value.split('?')[0].split('/').pop() || 'media');
}

const eventSchema = z.object({
  event: z.enum(['ideas_opened','idea_clicked','idea_to_generate_conversion','idea_generation_success','idea_generation_failure','studio_opened','studio_exported']),
  ideaId: z.string().max(120).optional(),
  feature: z.string().max(80).optional(),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.union([z.string(),z.number(),z.boolean(),z.null()])).optional(),
});

// Public/anonymous idea browsing can be measured without storing the prompt itself.
router.post('/events', tryAuth, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid Studio analytics event.' }); return; }
  await query(
    `INSERT INTO studio_events (user_id,project_id,event,idea_id,feature,metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [req.user?.id ?? null, parsed.data.projectId ?? null, parsed.data.event, parsed.data.ideaId ?? null, parsed.data.feature ?? null, JSON.stringify(parsed.data.metadata ?? {})],
  ).catch(() => {});
  res.status(204).end();
});

router.get('/admin/summary', requireAdmin, async (_req, res) => {
  const [projects, assets, operations, exports, ideas, costs] = await Promise.all([
    query<{ total: string; active_7d: string }>(`SELECT COUNT(*)::text total, COUNT(*) FILTER (WHERE updated_at >= NOW()-INTERVAL '7 days')::text active_7d FROM studio_projects WHERE deleted_at IS NULL`),
    query<{ total: string; bytes: string }>(`SELECT COUNT(*)::text total, COALESCE(SUM(size_bytes),0)::text bytes FROM studio_assets`),
    query<{ total: string; paid: string; credits: string; failures: string }>(`SELECT COUNT(*)::text total, COUNT(*) FILTER (WHERE execution_kind='paid')::text paid, COALESCE(SUM(final_credits),0)::text credits, COUNT(*) FILTER (WHERE status='failed')::text failures FROM studio_ai_operations`),
    query<{ total: string; completed: string; failed: string; avg_ms: string | null }>(`SELECT COUNT(*)::text total, COUNT(*) FILTER (WHERE status='completed')::text completed, COUNT(*) FILTER (WHERE status='failed')::text failed, AVG(render_time_ms)::text avg_ms FROM studio_exports`),
    query<{ idea_id: string; clicks: string; generates: string }>(`SELECT idea_id, COUNT(*) FILTER (WHERE event='idea_clicked')::text clicks, COUNT(*) FILTER (WHERE event='idea_to_generate_conversion')::text generates FROM studio_events WHERE idea_id IS NOT NULL GROUP BY idea_id ORDER BY COUNT(*) FILTER (WHERE event='idea_clicked') DESC LIMIT 20`),
    query<{ total: string }>(`SELECT COALESCE(SUM(actual_cost_usd),0)::text total FROM studio_ai_operations`),
  ]);
  res.json({
    projects: { total: Number(projects.rows[0]?.total ?? 0), active7d: Number(projects.rows[0]?.active_7d ?? 0) },
    assets: { total: Number(assets.rows[0]?.total ?? 0), bytes: Number(assets.rows[0]?.bytes ?? 0) },
    ai: { total: Number(operations.rows[0]?.total ?? 0), paid: Number(operations.rows[0]?.paid ?? 0), credits: Number(operations.rows[0]?.credits ?? 0), failures: Number(operations.rows[0]?.failures ?? 0), costUsd: Number(costs.rows[0]?.total ?? 0) },
    exports: { total: Number(exports.rows[0]?.total ?? 0), completed: Number(exports.rows[0]?.completed ?? 0), failed: Number(exports.rows[0]?.failed ?? 0), averageRenderMs: Number(exports.rows[0]?.avg_ms ?? 0) },
    ideas: ideas.rows.map((row) => ({ ideaId: row.idea_id, clicks: Number(row.clicks), generates: Number(row.generates) })),
  });
});

router.use(requireAuth);

router.get('/config', async (_req, res) => {
  const settings = await studioSettings();
  res.json(settings);
});

router.get('/projects', async (req, res) => {
  const result = await query<StudioProjectRow>(
    `SELECT * FROM studio_projects WHERE user_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 60`,
    [req.user!.id],
  );
  res.json({ projects: result.rows.map(projectPayload) });
});

router.post('/projects', async (req, res) => {
  const schema = z.object({ title: z.string().trim().min(1).max(120).optional(), kind: z.enum(['video','image']).default('video'), aspectRatio: z.enum(['16:9','9:16','1:1']).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: 'Invalid Studio project settings.' }); return; }
  const state = emptyStudioProjectState(parsed.data.kind, parsed.data.aspectRatio);
  const title = parsed.data.title ?? (parsed.data.kind === 'image' ? 'Untitled image' : 'Untitled video');
  const result = await query<StudioProjectRow>(
    `INSERT INTO studio_projects (user_id,title,kind,width,height,aspect_ratio,duration_seconds,project_state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
    [req.user!.id, title, parsed.data.kind, state.canvas.width, state.canvas.height, state.canvas.aspectRatio, state.duration, JSON.stringify(state)],
  );
  const project = result.rows[0];
  await query(`INSERT INTO studio_revisions (project_id,user_id,revision,label,project_state) VALUES ($1,$2,1,'Project created',$3::jsonb)`, [project.id, req.user!.id, JSON.stringify(state)]);
  res.status(201).json({ ...projectPayload(project), assets: [] });
});

router.post('/projects/import-job/:jobId', async (req, res) => {
  const jobId = String(req.params.jobId);
  const jobResult = await query<{ id: string; user_id: string | null; title: string | null; capture_metadata: Record<string, unknown> | null }>(
    `SELECT id,user_id,title,capture_metadata FROM jobs WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [jobId, req.user!.id],
  );
  const job = jobResult.rows[0];
  if (!job) { res.status(404).json({ error: 'Production not found.' }); return; }
  const sourceAssets = await query<{ id: string; type: string; storage_url: string; created_at: string }>(`SELECT id,type,storage_url,created_at FROM assets WHERE job_id=$1 ORDER BY created_at`, [jobId]);
  const urls: Array<{ id: string | null; type: string; storageUrl: string }> = sourceAssets.rows.map((item) => ({ id: item.id, type: item.type, storageUrl: item.storage_url }));
  if (!urls.length) {
    const capture = job.capture_metadata ?? {};
    const possible = [capture['screenshotUrl'], capture['fullPageScreenshotUrl'], capture['recordingUrl']].filter((item): item is string => typeof item === 'string' && item.startsWith('/api/assets/'));
    for (const storageUrl of possible) urls.push({ id: null, type: storageUrl.endsWith('.mp4') ? 'video' : 'screenshot', storageUrl });
  }
  if (!urls.length) { res.status(409).json({ error: 'This production has no importable media yet.' }); return; }

  let primaryInfo: { width: number | null; height: number | null; durationSeconds: number | null } = { width: null, height: null, durationSeconds: null };
  const primaryUrl = urls.find((item) => item.type === 'video')?.storageUrl ?? urls[0].storageUrl;
  try { const local = await materializeStudioAsset(primaryUrl); primaryInfo = await inspectStudioMedia(local.filePath); } catch { /* metadata is optional */ }
  const kind: 'video' | 'image' = mimeForUrl(primaryUrl).startsWith('video/') ? 'video' : 'image';
  const aspectRatio: '16:9' | '9:16' | '1:1' = primaryInfo.width && primaryInfo.height
    ? Math.abs(primaryInfo.width / primaryInfo.height - 1) < 0.08 ? '1:1' : primaryInfo.width > primaryInfo.height ? '16:9' : '9:16'
    : kind === 'image' ? '1:1' : '9:16';
  const state = emptyStudioProjectState(kind, aspectRatio);
  state.duration = kind === 'video' ? Math.max(0.1, primaryInfo.durationSeconds ?? 8) : 5;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const projectResult = await client.query<StudioProjectRow>(
      `INSERT INTO studio_projects (user_id,title,kind,width,height,aspect_ratio,duration_seconds,project_state,source_job_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
      [req.user!.id, `${job.title || 'AiWebVideo production'} edit`, kind, state.canvas.width, state.canvas.height, state.canvas.aspectRatio, state.duration, JSON.stringify(state), jobId],
    );
    const project = projectResult.rows[0];
    const imported: StudioAssetRow[] = [];
    for (const [index, source] of urls.entries()) {
      const mime = mimeForUrl(source.storageUrl);
      if (!studioMimeSupported(mime)) continue;
      let info = index === 0 ? primaryInfo : { width: null, height: null, durationSeconds: null };
      if (index !== 0) {
        try { const local = await materializeStudioAsset(source.storageUrl); info = await inspectStudioMedia(local.filePath); } catch { /* metadata optional */ }
      }
      const assetId = randomUUID();
      const kindValue = source.type === 'screenshot' ? 'screenshot' : studioAssetKind(mime, nameForUrl(source.storageUrl));
      const assetResult = await client.query<StudioAssetRow>(
        `INSERT INTO studio_assets (id,project_id,user_id,source_job_id,kind,name,mime_type,storage_url,source_url,width,height,duration_seconds,size_bytes,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,0,$12::jsonb) RETURNING *`,
        [assetId, project.id, req.user!.id, jobId, kindValue, nameForUrl(source.storageUrl), mime, source.storageUrl, info.width, info.height, info.durationSeconds, JSON.stringify({ importedAssetId: source.id })],
      );
      imported.push(assetResult.rows[0]);
    }
    const primaryAsset = imported.find((item) => item.mime_type.startsWith('video/')) ?? imported.find((item) => item.mime_type.startsWith('image/'));
    if (primaryAsset) {
      state.layers.push({
        id: randomUUID(), type: primaryAsset.mime_type.startsWith('video/') ? 'video' : 'image', name: primaryAsset.name, assetId: primaryAsset.id,
        start: 0, end: state.duration, trimStart: 0, trimEnd: null, x: 0.5, y: 0.5, width: 1, height: 1,
        rotation: 0, opacity: 1, volume: 1, speed: 1, style: {}, effects: [], transitionIn: null, transitionOut: null,
      });
      state.selectedLayerId = state.layers[0].id;
    }
    const validState = studioProjectStateSchema.parse(state);
    await client.query(`UPDATE studio_projects SET project_state=$2::jsonb,duration_seconds=$3 WHERE id=$1`, [project.id, JSON.stringify(validState), validState.duration]);
    await client.query(`INSERT INTO studio_revisions (project_id,user_id,revision,label,project_state) VALUES ($1,$2,1,'Imported AiWebVideo generation',$3::jsonb)`, [project.id, req.user!.id, JSON.stringify(validState)]);
    await client.query('COMMIT');
    res.status(201).json({ ...projectPayload({ ...project, project_state: validState }), assets: imported.map(signedAsset) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
});

router.get('/projects/:projectId', async (req, res) => {
  const result = await projectWithAssets(req.user!.id, String(req.params.projectId));
  if (!result) { res.status(404).json({ error: 'Studio project not found.' }); return; }
  res.json(result);
});

router.patch('/projects/:projectId', async (req, res) => {
  const schema = z.object({ revision: z.number().int().positive(), title: z.string().trim().min(1).max(120).optional(), projectState: z.unknown().optional(), label: z.string().trim().min(1).max(160).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid Studio project update.' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<StudioProjectRow>(`SELECT * FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [String(req.params.projectId), req.user!.id]);
    const project = result.rows[0];
    if (!project) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Studio project not found.' }); return; }
    if (project.revision !== parsed.data.revision) { await client.query('ROLLBACK'); res.status(409).json({ error: 'This project changed in another tab/device.', code: 'REVISION_CONFLICT', currentRevision: project.revision }); return; }
    let nextRevision = project.revision;
    if (parsed.data.projectState !== undefined) {
      const state = studioProjectStateSchema.parse(parsed.data.projectState);
      nextRevision = await saveRevision(client, project, state, parsed.data.label ?? 'Autosave', { ...(project.latest_context ?? {}), historyCursor: project.revision + 1 });
    }
    if (parsed.data.title) await client.query(`UPDATE studio_projects SET title=$3,updated_at=NOW() WHERE id=$1 AND user_id=$2`, [project.id, req.user!.id, parsed.data.title]);
    await client.query('COMMIT');
    const updated = await projectWithAssets(req.user!.id, project.id);
    res.json({ ...updated, revision: nextRevision });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Project state failed validation.', issues: error.issues }); return; }
    throw error;
  } finally { client.release(); }
});

router.delete('/projects/:projectId', async (req, res) => {
  const result = await query(`UPDATE studio_projects SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id`, [String(req.params.projectId), req.user!.id]);
  if (!result.rowCount) { res.status(404).json({ error: 'Studio project not found.' }); return; }
  res.status(204).end();
});

router.post('/projects/:projectId/media', upload.array('media', 12), async (req, res) => {
  const project = await ownedProject(req.user!.id, String(req.params.projectId));
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!project) { await Promise.all(files.map((file) => removeTemporaryUpload(file.path))); res.status(404).json({ error: 'Studio project not found.' }); return; }
  if (!files.length) { res.status(400).json({ error: 'Choose at least one media file.' }); return; }
  const inserted: StudioAssetRow[] = [];
  try {
    for (const file of files) {
      if (!(await verifyStudioFileMagic(file.path, file.mimetype))) throw new Error(`${safeStudioName(file.originalname)} does not match its declared file type.`);
      const persisted = await persistStudioUpload(project.id, file.path, file.mimetype);
      const info = await inspectStudioMedia(persisted.filePath);
      const stat = await fs.stat(persisted.filePath);
      const result = await query<StudioAssetRow>(
        `INSERT INTO studio_assets (project_id,user_id,kind,name,mime_type,storage_url,width,height,duration_seconds,size_bytes,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'{}'::jsonb) RETURNING *`,
        [project.id, req.user!.id, studioAssetKind(file.mimetype, file.originalname), safeStudioName(file.originalname), file.mimetype, persisted.storageUrl, info.width, info.height, info.durationSeconds, stat.size],
      );
      inserted.push(result.rows[0]);
    }
    res.status(201).json({ assets: inserted.map(signedAsset) });
  } catch (error) {
    await Promise.all(files.map((file) => removeTemporaryUpload(file.path)));
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not save Studio media.' });
  }
});

router.post('/projects/:projectId/history', async (req, res) => {
  const direction = req.body?.direction === 'redo' ? 'redo' : req.body?.direction === 'undo' ? 'undo' : null;
  if (!direction) { res.status(400).json({ error: 'Choose undo or redo.' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<StudioProjectRow>(`SELECT * FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [String(req.params.projectId), req.user!.id]);
    const project = result.rows[0];
    if (!project) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Studio project not found.' }); return; }
    const cursor = Number(project.latest_context?.historyCursor ?? project.revision);
    const revisionResult = await client.query<{ revision: number; project_state: unknown }>(
      direction === 'undo'
        ? `SELECT revision,project_state FROM studio_revisions WHERE project_id=$1 AND revision < $2 ORDER BY revision DESC LIMIT 1`
        : `SELECT revision,project_state FROM studio_revisions WHERE project_id=$1 AND revision > $2 AND revision <= $3 ORDER BY revision ASC LIMIT 1`,
      direction === 'undo' ? [project.id, cursor] : [project.id, cursor, project.revision],
    );
    const target = revisionResult.rows[0];
    if (!target) { await client.query('ROLLBACK'); res.status(409).json({ error: direction === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.' }); return; }
    const state = studioProjectStateSchema.parse(target.project_state);
    const latestContext = { ...(project.latest_context ?? {}), historyCursor: target.revision };
    await client.query(`UPDATE studio_projects SET project_state=$2::jsonb,latest_context=$3::jsonb,width=$4,height=$5,aspect_ratio=$6,duration_seconds=$7,updated_at=NOW() WHERE id=$1`, [project.id, JSON.stringify(state), JSON.stringify(latestContext), state.canvas.width, state.canvas.height, state.canvas.aspectRatio, state.duration]);
    await client.query('COMMIT');
    res.json({ projectState: state, revision: project.revision, historyCursor: target.revision });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
});

const aiRequestSchema = z.object({
  instruction: z.string().trim().min(1).max(8000),
  attachmentIds: z.array(z.string().uuid()).max(10).default([]),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

router.post('/projects/:projectId/ai/plan', async (req, res) => {
  const parsed = aiRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid AI Edit request.' }); return; }
  const project = await ownedProject(req.user!.id, String(req.params.projectId));
  if (!project) { res.status(404).json({ error: 'Studio project not found.' }); return; }
  const assets = parsed.data.attachmentIds.length ? await query<{ id: string; name: string }>(`SELECT id,name FROM studio_assets WHERE project_id=$1 AND user_id=$2 AND id=ANY($3::uuid[])`, [project.id, req.user!.id, parsed.data.attachmentIds]) : { rows: [] as Array<{ id: string; name: string }> };
  if (assets.rows.length !== parsed.data.attachmentIds.length) { res.status(400).json({ error: 'One or more AI Edit attachments do not belong to this project.' }); return; }
  try {
    const plan = planStudioInstruction(parsed.data.instruction, {
      project: studioProjectStateSchema.parse(project.project_state),
      attachmentIds: parsed.data.attachmentIds,
      attachmentNames: assets.rows.map((item) => item.name),
      lastLayerId: typeof project.latest_context?.lastLayerId === 'string' ? project.latest_context.lastLayerId : null,
    });
    if (plan.execution === 'paid' && plan.paidOperation) plan.costCredits = await configuredPrice(plan.paidOperation);
    res.json(plan);
  } catch (error) {
    res.status(422).json({ error: error instanceof Error ? error.message : 'Could not understand that edit.' });
  }
});

async function reservePaidOperation(input: { project: StudioProjectRow; userId: string; instruction: string; attachmentIds: string[]; operation: PaidStudioOperation; idempotencyKey: string; costCredits: number }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<StudioOperationRow>(`SELECT * FROM studio_ai_operations WHERE idempotency_key=$1 LIMIT 1`, [input.idempotencyKey]);
    if (existing.rows[0]) { await client.query('COMMIT'); return { operation: existing.rows[0], created: false }; }
    const projectLock = await client.query(`SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [input.project.id, input.userId]);
    if (!projectLock.rowCount) throw new Error('Studio project not found.');
    const debit = await client.query<{ credits_balance: number }>(`UPDATE users SET credits_balance=credits_balance-$2,updated_at=NOW() WHERE id=$1 AND credits_balance >= $2 RETURNING credits_balance`, [input.userId, input.costCredits]);
    if (!debit.rowCount) {
      const error = new Error(`This AI edit needs ${input.costCredits} credits.`) as Error & { code?: string };
      error.code = 'INSUFFICIENT_CREDITS';
      throw error;
    }
    const billingJob = await client.query<{ id: string }>(
      `INSERT INTO jobs (user_id,source_url,status,progress,mode,vibe_brief,credits_spent,title,generation_provider,capture_metadata)
       VALUES ($1,$2,'rendering',1,'photos',$3,$4,'Studio AI Edit','gemini',$5::jsonb) RETURNING id`,
      [input.userId, `studio://${input.project.id}/${input.operation}`, input.instruction.slice(0,8000), input.costCredits, JSON.stringify({ sourceType: 'studio-ai', studioProjectId: input.project.id, studioOperation: input.operation, attachmentIds: input.attachmentIds })],
    );
    const operationId = randomUUID();
    await client.query(`INSERT INTO credit_transactions (user_id,job_id,delta,reason) VALUES ($1,$2,$3,$4)`, [input.userId, billingJob.rows[0].id, -input.costCredits, `Studio AI ${input.operation}`]);
    const opResult = await client.query<StudioOperationRow>(
      `INSERT INTO studio_ai_operations (id,idempotency_key,project_id,user_id,operation_type,execution_kind,provider,instruction_hash,reserved_credits,final_credits,status,billing_job_id)
       VALUES ($1,$2,$3,$4,$5,'paid','gemini',$6,$7,0,'reserved',$8) RETURNING *`,
      [operationId, input.idempotencyKey, input.project.id, input.userId, input.operation, instructionHash(input.instruction), input.costCredits, billingJob.rows[0].id],
    );
    await client.query('COMMIT');
    return { operation: opResult.rows[0], created: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function refundUnstartedOperation(operation: StudioOperationRow, message: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query<StudioOperationRow>(`SELECT * FROM studio_ai_operations WHERE id=$1 FOR UPDATE`, [operation.id]);
    const current = locked.rows[0];
    if (!current || current.final_credits !== 0 || current.status === 'completed') { await client.query('ROLLBACK'); return; }
    await client.query(`UPDATE users SET credits_balance=credits_balance+$2,updated_at=NOW() WHERE id=$1`, [current.user_id, current.reserved_credits]);
    if (current.billing_job_id) {
      await client.query(`INSERT INTO credit_transactions (user_id,job_id,delta,reason) VALUES ($1,$2,$3,$4)`, [current.user_id, current.billing_job_id, current.reserved_credits, `Studio AI ${current.operation_type} released before provider start`]);
      await client.query(`UPDATE jobs SET status='failed',progress=100,credits_spent=0,error_message=$2,updated_at=NOW() WHERE id=$1`, [current.billing_job_id, message.slice(0,1000)]);
    }
    await client.query(`UPDATE studio_ai_operations SET status='failed',error=$2,updated_at=NOW() WHERE id=$1`, [current.id, message.slice(0,1000)]);
    await client.query('COMMIT');
  } catch { await client.query('ROLLBACK').catch(() => {}); } finally { client.release(); }
}

async function markChargedFailure(operation: StudioOperationRow, message: string) {
  await query(`UPDATE studio_ai_operations SET status='failed',final_credits=reserved_credits,error=$2,updated_at=NOW() WHERE id=$1`, [operation.id, message.slice(0,1000)]);
  if (operation.billing_job_id) await query(`UPDATE jobs SET status='failed',progress=100,error_message=$2,updated_at=NOW() WHERE id=$1`, [operation.billing_job_id, message.slice(0,1000)]);
}

async function executePaidImageOperation(operation: StudioOperationRow, instruction: string, attachmentIds: string[]) {
  if (!operation.billing_job_id) return;
  await query(`UPDATE studio_ai_operations SET status='running',updated_at=NOW() WHERE id=$1`, [operation.id]);
  try {
    const project = await ownedProject(operation.user_id, operation.project_id);
    if (!project) throw new StudioProviderError('Studio project was deleted before the AI edit started.', false);
    const state = studioProjectStateSchema.parse(project.project_state);
    let referenceIds = [...attachmentIds];
    if (!referenceIds.length) {
      const lastLayerId = typeof project.latest_context?.lastLayerId === 'string' ? project.latest_context.lastLayerId : state.selectedLayerId;
      const target = state.layers.find((item) => item.id === lastLayerId) ?? state.layers.find((item) => item.type === 'image');
      if (target?.assetId) referenceIds = [target.assetId];
    }
    const references: StudioReferenceImage[] = [];
    if (referenceIds.length) {
      const rows = await query<StudioAssetRow>(`SELECT * FROM studio_assets WHERE project_id=$1 AND user_id=$2 AND id=ANY($3::uuid[])`, [project.id, operation.user_id, referenceIds]);
      for (const asset of rows.rows) {
        if (!['image/jpeg','image/png','image/webp'].includes(asset.mime_type)) continue;
        const local = await materializeStudioAsset(asset.storage_url);
        references.push({ data: await fs.readFile(local.filePath), mimeType: asset.mime_type as StudioReferenceImage['mimeType'] });
      }
    }
    const result = await runStudioImageOperation({
      billingJobId: operation.billing_job_id,
      operationId: operation.id,
      operation: operation.operation_type as Exclude<PaidStudioOperation,'transcribe'>,
      instruction,
      references,
      aspectRatio: state.canvas.aspectRatio,
      quality: '1080p',
    });
    const outputAssetId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<StudioProjectRow>(`SELECT * FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [project.id, operation.user_id]);
      const current = currentResult.rows[0];
      if (!current) throw new Error('Studio project was deleted before the AI result could be saved.');
      const currentState = studioProjectStateSchema.parse(current.project_state);
      await client.query(
        `INSERT INTO studio_assets (id,project_id,user_id,source_job_id,kind,name,mime_type,storage_url,source_url,size_bytes,metadata)
         VALUES ($1,$2,$3,$4,'generated',$5,'image/png',$6,$6,0,$7::jsonb)`,
        [outputAssetId, current.id, operation.user_id, operation.billing_job_id, `AI ${operation.operation_type}.png`, result.storageUrl, JSON.stringify({ studioOperationId: operation.id, beforeAssetIds: referenceIds })],
      );
      const lastLayerId = typeof current.latest_context?.lastLayerId === 'string' ? current.latest_context.lastLayerId : currentState.selectedLayerId;
      const target = currentState.layers.find((item) => item.id === lastLayerId && item.type === 'image');
      let resultLayerId = target?.id ?? randomUUID();
      if (target && operation.operation_type !== 'generateImage') target.assetId = outputAssetId;
      else {
        currentState.layers.push({ id: resultLayerId, type: 'image', name: `AI ${operation.operation_type}`, assetId: outputAssetId, start: 0, end: Math.max(0.5, currentState.duration || 5), trimStart: 0, trimEnd: null, x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0, opacity: 1, volume: 1, speed: 1, style: {}, effects: [], transitionIn: null, transitionOut: null });
        currentState.selectedLayerId = resultLayerId;
        currentState.duration = Math.max(currentState.duration, 5);
      }
      const context = { ...(current.latest_context ?? {}), lastLayerId: resultLayerId, historyCursor: current.revision + 1 };
      await saveRevision(client, current, currentState, `AI ${operation.operation_type}`, context);
      await client.query(`UPDATE studio_ai_operations SET status='completed',model=$2,final_credits=reserved_credits,actual_cost_usd=$3,output_asset_id=$4,error=NULL,updated_at=NOW() WHERE id=$1`, [operation.id, result.model, result.actualCostUsd, outputAssetId]);
      await client.query(`UPDATE jobs SET status='done',progress=100,error_message=NULL,updated_at=NOW() WHERE id=$1`, [operation.billing_job_id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Studio AI edit failed.';
    if (error instanceof StudioProviderError && !error.providerStarted) await refundUnstartedOperation(operation, message);
    else await markChargedFailure(operation, message);
  }
}

router.post('/projects/:projectId/ai/apply', async (req, res) => {
  const parsed = aiRequestSchema.extend({ idempotencyKey: z.string().min(8).max(200) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid AI Edit apply request.' }); return; }
  const project = await ownedProject(req.user!.id, String(req.params.projectId));
  if (!project) { res.status(404).json({ error: 'Studio project not found.' }); return; }
  const assetRows = parsed.data.attachmentIds.length ? await query<{ id: string; name: string }>(`SELECT id,name FROM studio_assets WHERE project_id=$1 AND user_id=$2 AND id=ANY($3::uuid[])`, [project.id, req.user!.id, parsed.data.attachmentIds]) : { rows: [] as Array<{ id: string; name: string }> };
  if (assetRows.rows.length !== parsed.data.attachmentIds.length) { res.status(400).json({ error: 'One or more AI Edit attachments do not belong to this project.' }); return; }
  let plan;
  try {
    plan = planStudioInstruction(parsed.data.instruction, {
      project: studioProjectStateSchema.parse(project.project_state),
      attachmentIds: parsed.data.attachmentIds,
      attachmentNames: assetRows.rows.map((item) => item.name),
      lastLayerId: typeof project.latest_context?.lastLayerId === 'string' ? project.latest_context.lastLayerId : null,
    });
  } catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Could not understand that edit.' }); return; }

  if (plan.execution === 'paid' && plan.paidOperation) {
    if (plan.paidOperation === 'transcribe') { res.status(501).json({ error: 'AI transcription is currently feature-gated until the audio transcription provider is enabled.', code: 'FEATURE_DISABLED' }); return; }
    const settings = await studioSettings();
    if (settings.aiEditEnabled === false || settings.aiImagesEnabled === false) { res.status(503).json({ error: 'AI image editing is temporarily disabled.' }); return; }
    const costCredits = await configuredPrice(plan.paidOperation);
    try {
      const reservation = await reservePaidOperation({ project, userId: req.user!.id, instruction: parsed.data.instruction, attachmentIds: parsed.data.attachmentIds, operation: plan.paidOperation, idempotencyKey: parsed.data.idempotencyKey, costCredits });
      if (reservation.created) void executePaidImageOperation(reservation.operation, parsed.data.instruction, parsed.data.attachmentIds);
      res.status(reservation.created ? 202 : 200).json({ operationId: reservation.operation.id, status: reservation.operation.status, requiredCredits: reservation.operation.reserved_credits });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      res.status(code === 'INSUFFICIENT_CREDITS' ? 402 : 400).json({ error: error instanceof Error ? error.message : 'Could not authorize AI edit.', code });
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<StudioOperationRow>(`SELECT * FROM studio_ai_operations WHERE idempotency_key=$1 LIMIT 1`, [parsed.data.idempotencyKey]);
    if (existing.rows[0]) {
      await client.query('COMMIT');
      const current = await projectWithAssets(req.user!.id, project.id);
      res.json({ operationId: existing.rows[0].id, status: existing.rows[0].status, project: current });
      return;
    }
    const lockedResult = await client.query<StudioProjectRow>(`SELECT * FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [project.id, req.user!.id]);
    const locked = lockedResult.rows[0];
    if (!locked) throw new Error('Studio project not found.');
    const currentState = studioProjectStateSchema.parse(locked.project_state);
    const localPlan = planStudioInstruction(parsed.data.instruction, { project: currentState, attachmentIds: parsed.data.attachmentIds, attachmentNames: assetRows.rows.map((item) => item.name), lastLayerId: typeof locked.latest_context?.lastLayerId === 'string' ? locked.latest_context.lastLayerId : null });
    if (localPlan.execution !== 'local') throw new Error('This edit requires paid AI processing.');
    const nextState = applyStudioCommands(currentState, localPlan.commands);
    const context = { ...(locked.latest_context ?? {}), lastLayerId: localPlan.context.lastLayerId ?? nextState.selectedLayerId, historyCursor: locked.revision + 1 };
    await saveRevision(client, locked, nextState, localPlan.summary, context);
    const operationId = randomUUID();
    await client.query(
      `INSERT INTO studio_ai_operations (id,idempotency_key,project_id,user_id,operation_type,execution_kind,instruction_hash,commands,reserved_credits,final_credits,status)
       VALUES ($1,$2,$3,$4,'edit','local',$5,$6::jsonb,0,0,'completed')`,
      [operationId, parsed.data.idempotencyKey, locked.id, req.user!.id, instructionHash(parsed.data.instruction), JSON.stringify(localPlan.commands)],
    );
    await client.query('COMMIT');
    const current = await projectWithAssets(req.user!.id, locked.id);
    res.json({ operationId, status: 'completed', project: current, plan: localPlan });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not apply AI edit.' });
  } finally { client.release(); }
});

router.get('/operations/:operationId', async (req, res) => {
  const result = await query<StudioOperationRow>(`SELECT * FROM studio_ai_operations WHERE id=$1 AND user_id=$2 LIMIT 1`, [String(req.params.operationId), req.user!.id]);
  const operation = result.rows[0];
  if (!operation) { res.status(404).json({ error: 'Studio AI operation not found.' }); return; }
  let asset: StudioAssetRow | null = null;
  if (operation.output_asset_id) {
    const assetResult = await query<StudioAssetRow>(`SELECT * FROM studio_assets WHERE id=$1 AND user_id=$2 LIMIT 1`, [operation.output_asset_id, req.user!.id]);
    asset = assetResult.rows[0] ?? null;
  }
  res.json({
    id: operation.id,
    projectId: operation.project_id,
    operationType: operation.operation_type,
    executionKind: operation.execution_kind,
    status: operation.status,
    reservedCredits: operation.reserved_credits,
    finalCredits: operation.final_credits,
    actualCostUsd: Number(operation.actual_cost_usd || 0),
    error: operation.error,
    outputAsset: asset ? signedAsset(asset) : null,
    updatedAt: operation.updated_at,
  });
});

router.post('/operations/:operationId/cancel', async (req, res) => {
  const result = await query<StudioOperationRow>(`SELECT * FROM studio_ai_operations WHERE id=$1 AND user_id=$2 LIMIT 1`, [String(req.params.operationId), req.user!.id]);
  const operation = result.rows[0];
  if (!operation) { res.status(404).json({ error: 'Studio AI operation not found.' }); return; }
  if (operation.status === 'completed' || operation.status === 'failed') { res.status(409).json({ error: 'This operation has already finished.' }); return; }
  if (operation.billing_job_id) await query(`UPDATE jobs SET cancel_requested=TRUE,status_message='Cancellation requested',updated_at=NOW() WHERE id=$1`, [operation.billing_job_id]);
  res.json({ operationId: operation.id, cancellationRequested: true, warning: 'AI processing that has already started may still consume the credits used for this operation.' });
});

router.post('/projects/:projectId/exports', async (req, res) => {
  const schema = z.object({ resolution: z.enum(['720p','1080p','4k']).default('720p'), format: z.enum(['mp4','png','jpg']).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: 'Invalid export settings.' }); return; }
  const project = await ownedProject(req.user!.id, String(req.params.projectId));
  if (!project) { res.status(404).json({ error: 'Studio project not found.' }); return; }
  if (parsed.data.resolution === '1080p' && req.user!.plan === 'free') { res.status(402).json({ error: '1080p Studio export is available on a paid plan.', code: 'PLAN_REQUIRED' }); return; }
  if (parsed.data.resolution === '4k' && !['pro','agency'].includes(req.user!.plan)) { res.status(402).json({ error: '4K Studio export is available on Pro or Agency.', code: 'PLAN_REQUIRED' }); return; }
  const active = await query<{ count: string }>(`SELECT COUNT(*)::text count FROM studio_exports WHERE user_id=$1 AND status IN ('queued','preparing','rendering','encoding','uploading')`, [req.user!.id]);
  if (Number(active.rows[0]?.count ?? 0) >= 3) { res.status(429).json({ error: 'You already have three Studio exports processing. Let one finish first.' }); return; }
  const format = parsed.data.format ?? (project.kind === 'image' ? 'png' : 'mp4');
  if (project.kind === 'video' && format !== 'mp4') { res.status(400).json({ error: 'Video projects export as MP4.' }); return; }
  if (project.kind === 'image' && format === 'mp4') { res.status(400).json({ error: 'Image projects export as PNG or JPG.' }); return; }
  const result = await query<{ id: string }>(
    `INSERT INTO studio_exports (project_id,user_id,resolution,format,manifest) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
    [project.id, req.user!.id, parsed.data.resolution, format, JSON.stringify({ projectRevision: project.revision })],
  );
  queueStudioExport(result.rows[0].id);
  res.status(202).json({ exportId: result.rows[0].id, status: 'queued' });
});

router.get('/exports/:exportId', async (req, res) => {
  const result = await query<{ id: string; project_id: string; status: string; resolution: string; format: string; progress: number; storage_url: string | null; error: string | null; render_time_ms: string | number | null; created_at: string; updated_at: string }>(
    `SELECT id,project_id,status,resolution,format,progress,storage_url,error,render_time_ms,created_at,updated_at FROM studio_exports WHERE id=$1 AND user_id=$2 LIMIT 1`,
    [String(req.params.exportId), req.user!.id],
  );
  const item = result.rows[0];
  if (!item) { res.status(404).json({ error: 'Studio export not found.' }); return; }
  res.json({ ...item, storage_url: item.storage_url ? signPrivateAssetUrl(item.storage_url) : null, render_time_ms: Number(item.render_time_ms || 0) });
});

router.post('/exports/:exportId/cancel', async (req, res) => {
  const result = await query<{ id: string; status: string }>(`SELECT id,status FROM studio_exports WHERE id=$1 AND user_id=$2 LIMIT 1`, [String(req.params.exportId), req.user!.id]);
  const item = result.rows[0];
  if (!item) { res.status(404).json({ error: 'Studio export not found.' }); return; }
  if (!['queued','preparing'].includes(item.status)) { res.status(409).json({ error: 'This export is already rendering and cannot be safely interrupted.' }); return; }
  await query(`UPDATE studio_exports SET status='cancelled',progress=100,updated_at=NOW() WHERE id=$1`, [item.id]);
  res.json({ exportId: item.id, status: 'cancelled' });
});

export default router;
