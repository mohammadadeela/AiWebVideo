import { Router } from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth.js';
import { AppError, sendError } from '../lib/errors.js';
import { pool, query } from '../lib/pool.js';
import { ASSETS_DIR } from '../lib/capture.js';
import { deleteR2Object, uploadBufferToR2 } from '../lib/r2-storage.js';
import { logger } from '../lib/logger.js';

const router = Router();
const run = promisify(execFile);
export const INSPIRATION_FEATURES = ['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture'] as const;
const feature = z.enum(INSPIRATION_FEATURES);
const uuid = z.string().uuid();
const adminUpload = multer({
  storage: multer.memoryStorage(), limits: { files: 30, fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^(?:image\/(?:jpeg|png|webp)|video\/(?:mp4|webm|quicktime))$/i.test(file.mimetype)) cb(null, true);
    else cb(new AppError('Use JPEG, PNG, WEBP, MP4, WEBM, or MOV.', 400, 'UNSUPPORTED_MEDIA'));
  },
});

type MediaRow = {
  id: string; media_type: 'image' | 'video'; media_url: string; thumbnail_url: string;
  width: number | null; height: number | null; duration_seconds: number | null;
  status: string; featured: boolean; sort_order: number; admin_title: string | null;
  created_at: string; features: string[];
};

function present(row: MediaRow) {
  return {
    id: row.id, type: row.media_type, url: row.media_url, thumbnailUrl: row.thumbnail_url,
    width: row.width, height: row.height, durationSeconds: row.duration_seconds,
    status: row.status, featured: row.featured, sortOrder: row.sort_order,
    adminTitle: row.admin_title, createdAt: row.created_at, features: row.features || [],
  };
}

const columns = `m.id,m.media_type,m.media_url,m.thumbnail_url,m.width,m.height,m.duration_seconds,
  m.status,m.featured,m.sort_order,m.admin_title,m.created_at,
  COALESCE(array_agg(f.feature_id) FILTER (WHERE f.feature_id IS NOT NULL),ARRAY[]::text[]) AS features`;

router.get('/', async (req, res) => {
  try {
    const type = req.query.type === 'image' || req.query.type === 'video' ? req.query.type : null;
    const requestedFeature = typeof req.query.feature === 'string' ? feature.safeParse(req.query.feature) : null;
    if (requestedFeature && !requestedFeature.success) throw new AppError('Unknown feature.', 400, 'INVALID_FEATURE');
    const limit = Math.min(36, Math.max(1, Number(req.query.limit) || 18));
    const offset = Math.min(5000, Math.max(0, Number(req.query.offset) || 0));
    const rows = await query<MediaRow>(`SELECT ${columns}
      FROM inspiration_media m LEFT JOIN inspiration_features f ON f.media_id=m.id
      WHERE m.status='published' AND EXISTS (SELECT 1 FROM inspiration_features assigned WHERE assigned.media_id=m.id)
      AND ($1::text IS NULL OR m.media_type=$1)
      AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM inspiration_features x WHERE x.media_id=m.id AND x.feature_id=$2))
      GROUP BY m.id ORDER BY m.featured DESC,m.sort_order ASC,m.created_at DESC LIMIT $3 OFFSET $4`,
      [type, requestedFeature?.success ? requestedFeature.data : null, limit, offset]);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ items: rows.rows.map(present), hasMore: rows.rows.length === limit });
  } catch (error) { sendError(res, error); }
});

router.get('/:id', async (req, res) => {
  try {
    const id = uuid.parse(req.params.id);
    const { rows } = await query<MediaRow>(`SELECT ${columns} FROM inspiration_media m
      LEFT JOIN inspiration_features f ON f.media_id=m.id WHERE m.id=$1 AND m.status='published'
      AND EXISTS (SELECT 1 FROM inspiration_features assigned WHERE assigned.media_id=m.id)
      GROUP BY m.id`, [id]);
    if (!rows[0]) throw new AppError('Inspiration is unavailable.', 404, 'NOT_FOUND');
    res.json(present(rows[0]));
  } catch (error) { sendError(res, error); }
});

router.use('/admin', requireAdmin);

router.get('/admin/items', async (req, res) => {
  try {
    const search = String(req.query.search ?? '').trim().slice(0, 100);
    const status = ['draft', 'published', 'hidden'].includes(String(req.query.status)) ? req.query.status : null;
    const type = ['image', 'video'].includes(String(req.query.type)) ? req.query.type : null;
    const requestedFeature = typeof req.query.feature === 'string' ? feature.safeParse(req.query.feature) : null;
    if (requestedFeature && !requestedFeature.success) throw new AppError('Unknown feature.', 400, 'INVALID_FEATURE');
    const { rows } = await query<MediaRow>(`SELECT ${columns} FROM inspiration_media m
      LEFT JOIN inspiration_features f ON f.media_id=m.id
      WHERE ($1::text IS NULL OR m.status=$1) AND ($2::text IS NULL OR m.media_type=$2)
      AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM inspiration_features x WHERE x.media_id=m.id AND x.feature_id=$3))
      AND ($4::text='' OR COALESCE(m.admin_title,'') ILIKE '%' || $4 || '%' OR EXISTS
        (SELECT 1 FROM inspiration_features x WHERE x.media_id=m.id AND x.feature_id ILIKE '%' || $4 || '%'))
      GROUP BY m.id ORDER BY m.sort_order ASC,m.created_at DESC LIMIT 300`,
      [status, type, requestedFeature?.success ? requestedFeature.data : null, search]);
    res.json({ items: rows.map(present) });
  } catch (error) { sendError(res, error); }
});

router.post('/admin/upload', (req, res, next) => {
  if (Number(req.headers['content-length'] || 0) > 350 * 1024 * 1024) { res.status(413).json({ error: 'Upload up to 350 MB at a time.', code: 'UPLOAD_TOO_LARGE' }); return; }
  next();
}, adminUpload.array('files', 30), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw new AppError('Choose images or videos.', 400, 'NO_FILES');
    const items: Array<{ id: string; duplicate: boolean }> = [];
    const failures: Array<{ name: string; error: string }> = [];
    const directory = path.join(ASSETS_DIR, 'marketing');
    await fs.mkdir(directory, { recursive: true });
    const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
    for (const file of files) {
      const original = path.basename(file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120) || 'Untitled media';
      let mediaName: string | null = null;
      let posterName: string | null = null;
      const stored: string[] = [];
      try {
      if (file.mimetype.startsWith('image/') && file.size > 12 * 1024 * 1024) throw new AppError('Images must be under 12 MB.', 400, 'IMAGE_TOO_LARGE');
      const hash = createHash('sha256').update(file.buffer).digest('hex');
      const existing = await query<{ id: string }>('SELECT id FROM inspiration_media WHERE sha256=$1', [hash]);
      if (existing.rows[0]) { items.push({ id: existing.rows[0].id, duplicate: true }); continue; }
      const ext = extensions[file.mimetype];
      if (!ext) throw new AppError('Unsupported file type.', 400, 'UNSUPPORTED_MEDIA');
      const name = `inspiration-${randomUUID()}${ext}`;
      mediaName = name;
      const localFile = path.join(directory, name);
      await fs.writeFile(localFile, file.buffer);
      const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
      let thumbnailUrl = `/api/assets/marketing/${name}`;
      let width: number | null = null, height: number | null = null, duration: number | null = null;
      try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', localFile], { timeout: 15_000 });
        const metadata = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
        width = metadata.streams?.find((stream) => stream.width && stream.height)?.width ?? null;
        height = metadata.streams?.find((stream) => stream.width && stream.height)?.height ?? null;
        duration = type === 'video' ? Number(metadata.format?.duration) || null : null;
        if (!width || !height) throw new Error('No visual stream');
      } catch { throw new AppError(`Could not read ${file.originalname}. Use a supported image or video.`, 400, 'INVALID_MEDIA'); }
      {
        posterName = `inspiration-${randomUUID()}.jpg`;
        const posterPath = path.join(directory, posterName);
        try {
          await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', localFile,
            '-frames:v', '1', '-vf', 'scale=960:960:force_original_aspect_ratio=decrease',
            '-q:v', '4', posterPath], { timeout: 45_000, maxBuffer: 4 * 1024 * 1024 });
          const poster = await fs.readFile(posterPath);
          if (!poster.length) throw new Error('Empty preview');
          try {
            if (await uploadBufferToR2('marketing', posterName, poster)) stored.push(posterName);
          } catch (error) {
            logger.error({ err: error }, '[inspiration] preview storage failed');
            throw new AppError('Media storage is unavailable. Try this file again.', 503, 'MEDIA_STORAGE_FAILED');
          }
          thumbnailUrl = `/api/assets/marketing/${posterName}`;
        } catch (error) {
          if (error instanceof AppError) throw error;
          logger.warn({ err: error, mediaType: type }, '[inspiration] thumbnail generation failed');
          throw new AppError(`Could not prepare a preview for ${original}.`, 400, 'THUMBNAIL_FAILED');
        }
      }
      try {
        if (await uploadBufferToR2('marketing', name, file.buffer)) stored.push(name);
      } catch (error) {
        logger.error({ err: error }, '[inspiration] media storage failed');
        throw new AppError('Media storage is unavailable. Try this file again.', 503, 'MEDIA_STORAGE_FAILED');
      }
      const saved = await query<{ id: string }>(`INSERT INTO inspiration_media
        (media_type,media_url,thumbnail_url,width,height,duration_seconds,sha256,admin_title,uploaded_by,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM inspiration_media)) ON CONFLICT(sha256) DO NOTHING RETURNING id`,
        [type, `/api/assets/marketing/${name}`, thumbnailUrl, width, height, duration, hash, original, req.user!.id]);
      if (!saved.rows[0]) {
        const duplicate = await query<{ id: string }>('SELECT id FROM inspiration_media WHERE sha256=$1', [hash]);
        if (!duplicate.rows[0]) throw new Error('Duplicate media lookup failed');
        items.push({ id: duplicate.rows[0].id, duplicate: true });
        await Promise.allSettled([
          ...[mediaName, posterName].filter((value): value is string => Boolean(value))
            .map((value) => fs.rm(path.join(directory, value), { force: true })),
          ...stored.map((value) => deleteR2Object('marketing', value)),
        ]);
        continue;
      }
      items.push({ id: saved.rows[0].id, duplicate: false });
      } catch (error) {
        failures.push({ name: original, error: error instanceof AppError ? error.message : 'Upload failed. Try again.' });
        if (!(error instanceof AppError)) logger.error({ err: error }, '[inspiration] media upload failed');
        await Promise.allSettled([
          ...[mediaName, posterName].filter((value): value is string => Boolean(value))
            .map((value) => fs.rm(path.join(directory, value), { force: true })),
          ...stored.map((value) => deleteR2Object('marketing', value)),
        ]);
      }
    }
    res.status(failures.length ? 207 : 201).json({ items, failures });
  } catch (error) { sendError(res, error); }
});

const bulkBody = z.object({
  ids: z.array(uuid).min(1).max(300),
  features: z.array(feature).max(INSPIRATION_FEATURES.length).optional(),
  featuresMode: z.enum(['add', 'replace']).optional().default('add'),
  status: z.enum(['draft', 'published', 'hidden']).optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  delete: z.boolean().optional(),
});

router.patch('/admin/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const body = bulkBody.parse(req.body);
    const ids = [...new Set(body.ids)];
    await client.query('BEGIN');
    const found = await client.query<{ id: string }>('SELECT id FROM inspiration_media WHERE id=ANY($1::uuid[]) FOR UPDATE', [ids]);
    if (found.rows.length !== ids.length) throw new AppError('Some media could not be found.', 404, 'NOT_FOUND');
    let removed: Array<{ media_url: string; thumbnail_url: string }> = [];
    if (body.delete) {
      const toDelete = await client.query<{ media_url: string; thumbnail_url: string }>('SELECT media_url,thumbnail_url FROM inspiration_media WHERE id=ANY($1::uuid[])', [ids]);
      removed = toDelete.rows;
      await client.query('DELETE FROM inspiration_media WHERE id=ANY($1::uuid[])', [ids]);
    } else {
      if (body.features) {
        if (body.featuresMode === 'replace')
          await client.query('DELETE FROM inspiration_features WHERE media_id=ANY($1::uuid[])', [ids]);
        for (const id of ids) for (const assigned of body.features) {
          await client.query('INSERT INTO inspiration_features(media_id,feature_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, assigned]);
        }
      }
      if (body.status === 'published' || body.features) {
        const missing = await client.query<{ id: string; admin_title: string | null }>(`SELECT m.id,m.admin_title FROM inspiration_media m
          WHERE m.id=ANY($1::uuid[]) AND COALESCE($2::text,m.status)='published'
          AND NOT EXISTS (SELECT 1 FROM inspiration_features f WHERE f.media_id=m.id)`, [ids, body.status ?? null]);
        if (missing.rows.length) throw new AppError(`Assign a feature before publishing: ${missing.rows.map((row) => row.admin_title || row.id).join(', ')}`, 400, 'UNASSIGNED_MEDIA');
      }
      await client.query(`UPDATE inspiration_media SET status=COALESCE($2,status),featured=COALESCE($3,featured),
        sort_order=COALESCE($4,sort_order),updated_at=NOW() WHERE id=ANY($1::uuid[])`,
        [ids, body.status ?? null, body.featured ?? null, body.sortOrder ?? null]);
    }
    await client.query('COMMIT');
    res.json({ updated: ids.length });
    if (removed.length) void Promise.allSettled([...new Set(removed.flatMap((item) => [item.media_url, item.thumbnail_url]))].map(async (url) => {
      const filename = path.basename(new URL(url, 'http://local').pathname);
      if (!/^inspiration-[a-z0-9-]+\.(?:jpg|png|webp|mp4|webm|mov)$/.test(filename)) return;
      await Promise.allSettled([fs.rm(path.join(ASSETS_DIR, 'marketing', filename), { force: true }), deleteR2Object('marketing', filename)]);
    }));
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); sendError(res, error); }
  finally { client.release(); }
});

export default router;
