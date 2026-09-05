import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth.js';
import { pool, query } from '../lib/pool.js';
import { refundJobCredits } from '../lib/queries.js';
import { clearOperationsSettingsCache, getOperationsSettings } from '../lib/provider-config.js';
import { AppError, sendError } from '../lib/errors.js';
import multer from 'multer';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ASSETS_DIR } from '../lib/capture.js';
import { clearMarketingSettingsCache, getMarketingSettings, MAX_MARKETING_VIDEOS } from '../lib/marketing.js';
import { GEMINI_COST_CATALOG } from '../lib/costs.js';
import { CREDIT_COSTS, MAX_VIDEO_SECONDS, MIN_VIDEO_SECONDS, videoCreditQuote } from '../lib/credits.js';
import { getPayPalReadiness } from './paypal.js';
import { getProviderQueueSnapshot } from '../lib/provider-queue.js';

const router = Router();
router.use(requireAdmin);

const marketingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^video\/(mp4|webm|quicktime)$/i.test(file.mimetype) || /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new AppError('Upload an MP4, WEBM, MOV, JPEG, PNG, or WEBP file.', 400, 'UNSUPPORTED_FILE_TYPE'));
  },
});

async function audit(adminId: string, action: string, targetType?: string, targetId?: string, details?: unknown) {
  await query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)`,
    [adminId, action, targetType ?? null, targetId ?? null, details ? JSON.stringify(details) : null],
  );
}

router.get('/overview', async (req, res) => {
  try {
    const [users, jobs, spend, operations, recentJobs, marketing, costBreakdown, recentCosts] = await Promise.all([
      query<{ total: number; active: number; paid: number; admins: number }>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE account_status='active')::int active, COUNT(*) FILTER (WHERE plan<>'free')::int paid, COUNT(*) FILTER (WHERE is_admin)::int admins FROM users`),
      query<{ total: number; running: number; done: number; failed: number }>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status IN ('queued','capturing','storyboarding','rendering'))::int running, COUNT(*) FILTER (WHERE status='done')::int done, COUNT(*) FILTER (WHERE status='failed')::int failed FROM jobs WHERE deleted_at IS NULL`),
      query<{ credits: number; cost: number }>(`SELECT
        GREATEST(0, COALESCE(-SUM(ct.delta) FILTER (WHERE ct.job_id IS NOT NULL OR ct.reason LIKE 'Render %' OR ct.reason ILIKE '%refund%'),0))::int credits,
        (SELECT COALESCE(SUM(generation_cost_usd),0)::float FROM jobs WHERE created_at >= date_trunc('month', NOW())) AS cost
       FROM credit_transactions ct WHERE ct.created_at >= date_trunc('month', NOW())`),
      getOperationsSettings(),
      query(`SELECT j.id,j.title,j.source_url,j.status,j.progress,j.mode,j.generation_provider,j.generation_cost_usd,j.created_at,u.email FROM jobs j LEFT JOIN users u ON u.id=j.user_id WHERE j.deleted_at IS NULL ORDER BY j.created_at DESC LIMIT 8`),
      getMarketingSettings(),
      query(`SELECT provider,model,operation,unit,COALESCE(SUM(quantity),0)::float quantity,COALESCE(SUM(total_cost_usd),0)::float cost,COUNT(*)::int events FROM generation_cost_events WHERE created_at >= date_trunc('month',NOW()) GROUP BY provider,model,operation,unit ORDER BY cost DESC`),
      query(`SELECT c.id,c.job_id,c.provider,c.model,c.operation,c.quantity,c.unit,c.unit_cost_usd,c.total_cost_usd,c.created_at,j.title FROM generation_cost_events c LEFT JOIN jobs j ON j.id=c.job_id ORDER BY c.created_at DESC LIMIT 30`),
    ]);
    const videoCostMatrix = Array.from({ length: MAX_VIDEO_SECONDS - MIN_VIDEO_SECONDS + 1 }, (_, index) => {
      const seconds = MIN_VIDEO_SECONDS + index;
      const continuousOperations = seconds <= 8 ? 1 : 1 + Math.ceil((seconds - 8) / 7);
      return {
        seconds,
        continuousOperations,
        geminiFast1080Usd: seconds * GEMINI_COST_CATALOG.video.fast1080,
        geminiFast4kUsd: seconds * GEMINI_COST_CATALOG.video.fast4k,
        geminiStandard1080Usd: seconds * GEMINI_COST_CATALOG.video.standard1080,
        geminiStandard4kUsd: seconds * GEMINI_COST_CATALOG.video.standard4k,
        userCredits1080: seconds * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P,
        userCredits4k: seconds * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K,
        narrationCredits: CREDIT_COSTS.VOICEOVER,
        videoAndPhotosExtraCredits: CREDIT_COSTS.PHOTO_SET_4,
      };
    });
    res.json({
      users: users.rows[0], jobs: jobs.rows[0], usage: spend.rows[0], operations,
      providerStatus: {
        geminiApiKey: Boolean(process.env.GEMINI_API_KEY),
        cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        checkout: getPayPalReadiness(),
        queues: getProviderQueueSnapshot(),
      },
      recentJobs: recentJobs.rows, marketing,
      costCatalog: GEMINI_COST_CATALOG,
      costBreakdown: costBreakdown.rows,
      recentCosts: recentCosts.rows,
      videoCostMatrix,
    });
  } catch (error) { sendError(res, error); }
});

router.post('/marketing/upload', marketingUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new AppError('Choose a file to upload.', 400, 'NO_FILE');
    const extByMime: Record<string, string> = {
      'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    };
    const extension = extByMime[req.file.mimetype];
    if (!extension) throw new AppError('Unsupported file type.', 400, 'UNSUPPORTED_FILE_TYPE');
    const directory = path.join(ASSETS_DIR, 'marketing');
    await fs.mkdir(directory, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
    await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
    await audit(req.user!.id, 'marketing.asset_uploaded', 'marketing', filename, { mime: req.file.mimetype, bytes: req.file.size });
    res.status(201).json({ url: `/api/assets/marketing/${filename}`, kind: req.file.mimetype.startsWith('video/') ? 'video' : 'image' });
  } catch (error) { sendError(res, error); }
});

router.put('/marketing', async (req, res) => {
  try {
    const nullableText = z.string().trim().max(200).nullable();
    const video = z.object({
      id: z.string().trim().min(1).max(40),
      url: z.string().trim().max(2000).nullable(),
      posterUrl: z.string().trim().max(2000).nullable(),
      caption: nullableText,
      overlayText: nullableText,
      eyebrow: z.string().trim().max(60).nullable(),
    });
    const body = z.object({
      heading: z.string().trim().min(1).max(100),
      description: z.string().trim().min(1).max(300),
      videos: z.object({ showcase: z.array(video).max(MAX_MARKETING_VIDEOS) }),
    }).parse(req.body);
    await query(`INSERT INTO system_settings(key,value,updated_by) VALUES ('marketing',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [JSON.stringify(body), req.user!.id]);
    clearMarketingSettingsCache();
    await audit(req.user!.id, 'marketing.updated', 'system', 'landing', body);
    res.json(body);
  } catch (error) { sendError(res, error); }
});

router.get('/users', async (req, res) => {
  try {
    const search = String(req.query.search ?? '').trim().slice(0, 200);
    const requestedPage = Number(req.query.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 100_000)
      : 1;
    const planFilter = String(req.query.plan ?? 'all');
    const roleFilter = String(req.query.role ?? 'all');
    const statusFilter = String(req.query.status ?? 'all');
    const authFilter = String(req.query.auth ?? 'all');
    const verifiedFilter = String(req.query.verified ?? 'all');
    const limit = 25;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (search) {
      values.push(`%${search}%`);
      clauses.push(`(u.email ILIKE $${values.length} OR u.id::text ILIKE $${values.length})`);
    }
    if (['free', 'creator', 'pro', 'agency'].includes(planFilter)) {
      values.push(planFilter);
      clauses.push(`u.plan = $${values.length}`);
    }
    if (roleFilter === 'admin') clauses.push(`u.is_admin = TRUE`);
    else if (roleFilter === 'user') clauses.push(`u.is_admin = FALSE`);
    if (['active', 'suspended'].includes(statusFilter)) {
      values.push(statusFilter);
      clauses.push(`u.account_status = $${values.length}`);
    }
    if (['email', 'google', 'github', 'facebook', 'firebase', 'unknown'].includes(authFilter)) {
      values.push(authFilter);
      clauses.push(`u.auth_provider = $${values.length}`);
    }
    if (verifiedFilter === 'verified') clauses.push(`u.email_verified = TRUE`);
    else if (verifiedFilter === 'unverified') clauses.push(`u.email_verified = FALSE`);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countValues = [...values];
    values.push(limit, (page - 1) * limit);
    const limitIndex = values.length - 1;
    const rows = await query<Record<string, unknown>>(
      `SELECT
         u.id,u.email,u.plan,u.credits_balance,u.is_admin,u.account_status,u.created_at,u.updated_at,
         u.email_verified,u.auth_provider,u.last_sign_in_at,
         CASE WHEN u.paypal_payer_id IS NOT NULL THEN TRUE ELSE FALSE END has_paypal_payer,
         (SELECT COUNT(*)::int FROM jobs j WHERE j.user_id=u.id AND j.deleted_at IS NULL) AS job_count,
         (SELECT COUNT(*)::int FROM jobs j WHERE j.user_id=u.id AND j.deleted_at IS NULL AND j.status='done') AS completed_jobs,
         (SELECT COUNT(*)::int FROM jobs j WHERE j.user_id=u.id AND j.deleted_at IS NULL AND j.status IN ('queued','capturing','storyboarding','rendering')) AS running_jobs,
         (SELECT COUNT(*)::int FROM jobs j WHERE j.user_id=u.id AND j.deleted_at IS NULL AND j.status='failed') AS failed_jobs,
         COALESCE((SELECT SUM(CASE WHEN ct.delta > 0 THEN ct.delta ELSE 0 END) FROM credit_transactions ct WHERE ct.user_id=u.id),0)::int AS credits_added,
         COALESCE((SELECT SUM(CASE WHEN ct.delta < 0 THEN -ct.delta ELSE 0 END) FROM credit_transactions ct WHERE ct.user_id=u.id),0)::int AS credits_used,
         COALESCE((SELECT SUM(ct.delta) FROM credit_transactions ct WHERE ct.user_id=u.id AND ct.delta > 0 AND ct.reason ILIKE '%refund%'),0)::int AS credits_refunded,
         COALESCE((SELECT SUM(p.credits_granted) FROM payments p WHERE p.user_id=u.id AND p.status='paid'),0)::int AS credits_purchased,
         COALESCE((SELECT SUM(p.amount_usd) FROM payments p WHERE p.user_id=u.id AND p.status='paid'),0)::float AS lifetime_paid_usd,
         (SELECT p.provider FROM payments p WHERE p.user_id=u.id AND p.status='paid' ORDER BY p.created_at DESC LIMIT 1) AS last_payment_provider,
         (SELECT p.created_at FROM payments p WHERE p.user_id=u.id AND p.status='paid' ORDER BY p.created_at DESC LIMIT 1) AS last_payment_at,
         (SELECT s.plan FROM subscriptions s WHERE s.user_id=u.id ORDER BY (s.status='active') DESC, s.updated_at DESC LIMIT 1) AS subscription_plan,
         (SELECT s.status FROM subscriptions s WHERE s.user_id=u.id ORDER BY (s.status='active') DESC, s.updated_at DESC LIMIT 1) AS subscription_status,
         (SELECT CASE WHEN s.paypal_subscription_id IS NOT NULL THEN 'payment' ELSE NULL END FROM subscriptions s WHERE s.user_id=u.id ORDER BY (s.status='active') DESC, s.updated_at DESC LIMIT 1) AS subscription_provider,
         (SELECT s.auto_renew FROM subscriptions s WHERE s.user_id=u.id ORDER BY (s.status='active') DESC, s.updated_at DESC LIMIT 1) AS subscription_auto_renew,
         (SELECT s.current_period_end FROM subscriptions s WHERE s.user_id=u.id ORDER BY (s.status='active') DESC, s.updated_at DESC LIMIT 1) AS subscription_period_end
       FROM users u ${where}
       ORDER BY u.created_at DESC
       LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      values,
    );
    const [count, summary, pending] = await Promise.all([
      query<{ total: number }>(`SELECT COUNT(*)::int total FROM users u ${where}`, countValues),
      query<Record<string, unknown>>(`SELECT
        COUNT(*)::int total,
        COUNT(*) FILTER (WHERE account_status='active')::int active,
        COUNT(*) FILTER (WHERE account_status='suspended')::int suspended,
        COUNT(*) FILTER (WHERE is_admin)::int admins,
        COUNT(*) FILTER (WHERE plan<>'free')::int paid_plans,
        COUNT(*) FILTER (WHERE email_verified)::int verified,
        COUNT(*) FILTER (WHERE auth_provider='email')::int email_auth,
        COUNT(*) FILTER (WHERE auth_provider IN ('google','github','facebook','firebase'))::int social_auth
        FROM users`),
      query<Record<string, unknown>>(`SELECT email,attempts,expires_at,created_at FROM pending_verifications ORDER BY created_at DESC LIMIT 50`),
    ]);
    const pendingCount = await query<{ total: number }>(`SELECT COUNT(*)::int total FROM pending_verifications`);
    res.json({
      users: rows.rows,
      total: count.rows[0]?.total ?? 0,
      page,
      pageSize: limit,
      adminCount: Number(summary.rows[0]?.admins ?? 0),
      summary: { ...summary.rows[0], pending: pendingCount.rows[0]?.total ?? 0 },
      pendingSignups: pending.rows,
    });
  } catch (error) { sendError(res, error); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const account = await query<Record<string, unknown>>(
      `SELECT id,email,plan,credits_balance,is_admin,account_status,email_verified,auth_provider,last_sign_in_at,created_at,updated_at,
        CASE WHEN paypal_payer_id IS NOT NULL THEN TRUE ELSE FALSE END has_paypal_payer
       FROM users WHERE id=$1`,
      [req.params.id],
    );
    if (!account.rows[0]) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    const [subscriptions, payments, credits, productions] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT id,plan,status,auto_renew,current_period_start,current_period_end,created_at,updated_at,
          CASE WHEN paypal_subscription_id IS NOT NULL THEN 'payment' ELSE 'manual' END provider
         FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 20`, [req.params.id]),
      query<Record<string, unknown>>(
        `SELECT id,provider,kind,amount_usd,currency,credits_granted,plan,status,created_at
         FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [req.params.id]),
      query<Record<string, unknown>>(
        `SELECT id,job_id,delta,reason,created_at FROM credit_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.params.id]),
      query<Record<string, unknown>>(
        `SELECT id,title,source_url,mode,status,progress,credits_spent,generation_provider,generation_cost_usd,created_at,updated_at
         FROM jobs WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30`, [req.params.id]),
    ]);
    res.json({ user: account.rows[0], subscriptions: subscriptions.rows, payments: payments.rows, credits: credits.rows, productions: productions.rows });
  } catch (error) { sendError(res, error); }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const patch = z.object({
      plan: z.enum(['free', 'creator', 'pro', 'agency']).optional(),
      creditsBalance: z.number().int().min(0).max(10_000_000).optional(),
      accountStatus: z.enum(['active', 'suspended']).optional(),
      isAdmin: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0).parse(req.body);
    if (req.params.id === req.user!.id && (patch.accountStatus === 'suspended' || patch.isAdmin === false)) {
      throw new AppError('You cannot suspend yourself or remove your own administrator access.', 400, 'SELF_LOCKOUT');
    }

    const client = await pool.connect();
    let updatedUser: Record<string, unknown> | null = null;
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<Record<string, unknown>>(
        `SELECT id,email,plan,credits_balance,is_admin,account_status FROM users WHERE id=$1 FOR UPDATE`,
        [req.params.id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
      if (patch.isAdmin === false && Boolean(current.is_admin)) {
        const adminCount = await client.query<{ total: number }>('SELECT COUNT(*)::int total FROM users WHERE is_admin=TRUE');
        if ((adminCount.rows[0]?.total ?? 0) <= 1) {
          throw new AppError('This is the last administrator account. Promote another user to admin before removing this one.', 400, 'LAST_ADMIN');
        }
      }

      const sets: string[] = ['updated_at=NOW()'];
      const values: unknown[] = [];
      let index = 1;
      if (patch.plan !== undefined) { sets.push(`plan=$${index++}`); values.push(patch.plan); }
      if (patch.creditsBalance !== undefined) { sets.push(`credits_balance=$${index++}`); values.push(patch.creditsBalance); }
      if (patch.accountStatus !== undefined) { sets.push(`account_status=$${index++}`); values.push(patch.accountStatus); }
      if (patch.isAdmin !== undefined) { sets.push(`is_admin=$${index++}`); values.push(patch.isAdmin); }
      values.push(req.params.id);
      const updated = await client.query<Record<string, unknown>>(
        `UPDATE users SET ${sets.join(',')} WHERE id=$${index}
         RETURNING id,email,plan,credits_balance,is_admin,account_status,email_verified,auth_provider,last_sign_in_at,created_at,updated_at`,
        values,
      );
      updatedUser = updated.rows[0] ?? null;
      if (!updatedUser) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

      if (patch.creditsBalance !== undefined) {
        const previousBalance = Number(current.credits_balance ?? 0);
        const delta = patch.creditsBalance - previousBalance;
        if (delta !== 0) {
          await client.query(
            `INSERT INTO credit_transactions (user_id,job_id,delta,reason) VALUES ($1,NULL,$2,$3)`,
            [req.params.id, delta, `Admin balance adjustment by ${req.user!.email}`],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    await audit(req.user!.id, 'user.updated', 'user', req.params.id, patch);
    res.json({ user: updatedUser });
  } catch (error) { sendError(res, error); }
});

router.get('/jobs', async (req, res) => {
  try {
    const status = String(req.query.status ?? 'all');
    const search = String(req.query.search ?? '').trim();
    const clauses = ['j.deleted_at IS NULL']; const values: unknown[] = [];
    if (status !== 'all') { values.push(status); clauses.push(`j.status=$${values.length}`); }
    if (search) { values.push(`%${search}%`); clauses.push(`(j.title ILIKE $${values.length} OR j.source_url ILIKE $${values.length} OR u.email ILIKE $${values.length})`); }
    values.push(100);
    const rows = await query<Record<string, unknown>>(
      `SELECT j.id,j.title,j.source_url,j.status,j.progress,j.mode,j.status_message,j.error_message,j.generation_provider,j.generation_cost_usd,j.credits_spent,j.storyboard,j.workflow_state,j.created_at,j.updated_at,u.email,
        GREATEST(j.credits_spent, GREATEST(0, -COALESCE((SELECT SUM(ct.delta) FROM credit_transactions ct WHERE ct.user_id=j.user_id AND (ct.job_id=j.id OR (ct.job_id IS NULL AND ct.reason ILIKE '%' || j.id::text || '%'))),0)))::int AS credits_charged
       FROM jobs j LEFT JOIN users u ON u.id=j.user_id WHERE ${clauses.join(' AND ')} ORDER BY j.updated_at DESC LIMIT $${values.length}`,
      values,
    );
    const jobsWithCredits = rows.rows.map((row) => {
      const storyboard = (row.storyboard && typeof row.storyboard === 'object' ? row.storyboard : {}) as Record<string, unknown>;
      const workflow = (row.workflow_state && typeof row.workflow_state === 'object' ? row.workflow_state : {}) as Record<string, unknown>;
      const durationSeconds = Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_VIDEO_SECONDS, Number(storyboard.targetDurationSeconds ?? workflow.durationSeconds ?? MIN_VIDEO_SECONDS) || MIN_VIDEO_SECONDS));
      const outputQuality = (storyboard.outputQuality ?? workflow.outputQuality) === '4k' ? '4k' as const : '1080p' as const;
      const audioMode = String(workflow.audioMode ?? 'native_audio');
      const skipVoiceover = audioMode !== 'voice_music';
      const quote = videoCreditQuote(String(row.mode ?? 'video'), skipVoiceover, durationSeconds, outputQuality);
      return {
        ...row,
        credits_quoted: quote.totalCredits,
        duration_seconds: quote.generatedSeconds,
        output_quality: outputQuality,
        audio_mode: audioMode,
      };
    });
    res.json({ jobs: jobsWithCredits });
  } catch (error) { sendError(res, error); }
});

router.patch('/jobs/:id', async (req, res) => {
  try {
    const { action } = z.object({ action: z.enum(['cancel', 'hide']) }).parse(req.body);
    let result;
    if (action === 'cancel') {
      // Refund whatever was already charged before settling the job — the
      // previous version of this action marked the job failed but never
      // returned the user's credits, which is a real billing bug.
      const { rows: jobRows } = await query<{ id: string; user_id: string | null; credits_spent: number; status: string }>(
        `SELECT id, user_id, credits_spent, status FROM jobs WHERE id=$1 AND status IN ('queued','capturing','storyboarding','rendering')`,
        [req.params.id],
      );
      const job = jobRows[0];
      if (!job) throw new AppError('Job cannot be updated in its current state.', 409, 'JOB_NOT_UPDATED');
      if (job.user_id && job.credits_spent > 0) {
        await refundJobCredits(job.id, job.user_id, job.credits_spent, `Cancelled by admin ${req.user!.id}`);
      }
      result = await query(
        `UPDATE jobs SET status='cancelled', cancel_requested=TRUE, error_message='Cancelled by an administrator. Any reserved credits were refunded.', status_message='Cancelled', eta_seconds=0, credits_spent=0, updated_at=NOW() WHERE id=$1 RETURNING id,status`,
        [req.params.id],
      );
    } else {
      result = await query(`UPDATE jobs SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,status`, [req.params.id]);
    }
    if (!result.rows[0]) throw new AppError('Job cannot be updated in its current state.', 409, 'JOB_NOT_UPDATED');
    await audit(req.user!.id, `job.${action}`, 'job', req.params.id);
    res.json({ job: result.rows[0] });
  } catch (error) { sendError(res, error); }
});

router.put('/settings', async (req, res) => {
  try {
    const body = z.object({
      operations: z.object({ maintenanceMode: z.boolean(), registrationsEnabled: z.boolean(), maxConcurrentJobs: z.number().int().min(1).max(20) }),
    }).parse(req.body);
    await query(`INSERT INTO system_settings(key,value,updated_by) VALUES ('operations',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [JSON.stringify(body.operations), req.user!.id]);
    clearOperationsSettingsCache();
    await audit(req.user!.id, 'settings.updated', 'system', 'runtime', body);
    res.json({ operations: body.operations });
  } catch (error) { sendError(res, error); }
});

router.get('/audit', async (_req, res) => {
  try {
    const rows = await query(`SELECT a.id,a.action,a.target_type,a.target_id,a.details,a.created_at,u.email admin_email FROM admin_audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 100`);
    res.json({ events: rows.rows });
  } catch (error) { sendError(res, error); }
});

export default router;
