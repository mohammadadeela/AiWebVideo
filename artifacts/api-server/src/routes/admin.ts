import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth.js';
import { query } from '../lib/pool.js';
import { clearProviderSettingsCache, getOperationsSettings, getProviderSettings, providerAvailability } from '../lib/provider-config.js';
import { AppError, sendError } from '../lib/errors.js';

const router = Router();
router.use(requireAdmin);

async function audit(adminId: string, action: string, targetType?: string, targetId?: string, details?: unknown) {
  await query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)`,
    [adminId, action, targetType ?? null, targetId ?? null, details ? JSON.stringify(details) : null],
  );
}

router.get('/overview', async (req, res) => {
  try {
    const [users, jobs, spend, providers, operations, recentJobs] = await Promise.all([
      query<{ total: number; active: number; paid: number; admins: number }>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE account_status='active')::int active, COUNT(*) FILTER (WHERE plan<>'free')::int paid, COUNT(*) FILTER (WHERE is_admin)::int admins FROM users`),
      query<{ total: number; running: number; done: number; failed: number }>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status IN ('queued','capturing','storyboarding','rendering'))::int running, COUNT(*) FILTER (WHERE status='done')::int done, COUNT(*) FILTER (WHERE status='failed')::int failed FROM jobs WHERE deleted_at IS NULL`),
      query<{ credits: number; cost: number; gpu_seconds: number }>(`SELECT COALESCE(SUM(credits_spent),0)::int credits, COALESCE(SUM(generation_cost_usd),0)::float cost, COALESCE(SUM(gpu_seconds),0)::float gpu_seconds FROM jobs WHERE created_at >= date_trunc('month', NOW())`),
      getProviderSettings(), getOperationsSettings(),
      query(`SELECT j.id,j.title,j.source_url,j.status,j.progress,j.mode,j.generation_provider,j.generation_cost_usd,j.created_at,u.email FROM jobs j LEFT JOIN users u ON u.id=j.user_id WHERE j.deleted_at IS NULL ORDER BY j.created_at DESC LIMIT 8`),
    ]);
    res.json({
      users: users.rows[0], jobs: jobs.rows[0], usage: spend.rows[0], providers, operations,
      providerStatus: {
        image: providerAvailability('image'), video: providerAvailability('video'),
        runpodApiKey: Boolean(process.env.RUNPOD_API_KEY), cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      },
      recentJobs: recentJobs.rows,
    });
  } catch (error) { sendError(res, error); }
});

router.get('/users', async (req, res) => {
  try {
    const search = String(req.query.search ?? '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 25;
    const values: unknown[] = [];
    const where = search ? `WHERE u.email ILIKE $1` : '';
    if (search) values.push(`%${search}%`);
    values.push(limit, (page - 1) * limit);
    const limitIndex = values.length - 1;
    const rows = await query(
      `SELECT u.id,u.email,u.plan,u.credits_balance,u.is_admin,u.account_status,u.created_at,u.updated_at,
        COUNT(j.id)::int job_count, COUNT(j.id) FILTER (WHERE j.status='done')::int completed_jobs,
        COALESCE(SUM(j.credits_spent),0)::int credits_used
       FROM users u LEFT JOIN jobs j ON j.user_id=u.id AND j.deleted_at IS NULL ${where}
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      values,
    );
    const countValues = search ? [values[0]] : [];
    const count = await query<{ total: number }>(`SELECT COUNT(*)::int total FROM users u ${where}`, countValues);
    res.json({ users: rows.rows, total: count.rows[0]?.total ?? 0, page, pageSize: limit });
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
    const sets: string[] = ['updated_at=NOW()']; const values: unknown[] = []; let index = 1;
    if (patch.plan !== undefined) { sets.push(`plan=$${index++}`); values.push(patch.plan); }
    if (patch.creditsBalance !== undefined) { sets.push(`credits_balance=$${index++}`); values.push(patch.creditsBalance); }
    if (patch.accountStatus !== undefined) { sets.push(`account_status=$${index++}`); values.push(patch.accountStatus); }
    if (patch.isAdmin !== undefined) { sets.push(`is_admin=$${index++}`); values.push(patch.isAdmin); }
    values.push(req.params.id);
    const updated = await query(`UPDATE users SET ${sets.join(',')} WHERE id=$${index} RETURNING id,email,plan,credits_balance,is_admin,account_status,updated_at`, values);
    if (!updated.rows[0]) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    await audit(req.user!.id, 'user.updated', 'user', req.params.id, patch);
    res.json({ user: updated.rows[0] });
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
    const rows = await query(
      `SELECT j.id,j.title,j.source_url,j.status,j.progress,j.mode,j.status_message,j.error_message,j.generation_provider,j.gpu_seconds,j.generation_cost_usd,j.credits_spent,j.created_at,j.updated_at,u.email
       FROM jobs j LEFT JOIN users u ON u.id=j.user_id WHERE ${clauses.join(' AND ')} ORDER BY j.updated_at DESC LIMIT $${values.length}`,
      values,
    );
    res.json({ jobs: rows.rows });
  } catch (error) { sendError(res, error); }
});

router.patch('/jobs/:id', async (req, res) => {
  try {
    const { action } = z.object({ action: z.enum(['cancel', 'hide']) }).parse(req.body);
    const result = action === 'cancel'
      ? await query(`UPDATE jobs SET status='failed',error_message='Cancelled by an administrator.',status_message='Cancelled',eta_seconds=0,updated_at=NOW() WHERE id=$1 AND status IN ('queued','capturing','storyboarding','rendering') RETURNING id,status`, [req.params.id])
      : await query(`UPDATE jobs SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,status`, [req.params.id]);
    if (!result.rows[0]) throw new AppError('Job cannot be updated in its current state.', 409, 'JOB_NOT_UPDATED');
    await audit(req.user!.id, `job.${action}`, 'job', req.params.id);
    res.json({ job: result.rows[0] });
  } catch (error) { sendError(res, error); }
});

router.put('/settings', async (req, res) => {
  try {
    const body = z.object({
      providers: z.object({ image: z.enum(['auto','gemini','open_source']), video: z.enum(['auto','gemini','open_source']), fallbackEnabled: z.boolean() }),
      operations: z.object({ maintenanceMode: z.boolean(), registrationsEnabled: z.boolean(), maxConcurrentJobs: z.number().int().min(1).max(20) }),
    }).parse(req.body);
    await query(`INSERT INTO system_settings(key,value,updated_by) VALUES ('providers',$1,$3),('operations',$2,$3) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [JSON.stringify(body.providers), JSON.stringify(body.operations), req.user!.id]);
    clearProviderSettingsCache();
    await audit(req.user!.id, 'settings.updated', 'system', 'runtime', body);
    res.json({ providers: body.providers, operations: body.operations });
  } catch (error) { sendError(res, error); }
});

router.get('/audit', async (_req, res) => {
  try {
    const rows = await query(`SELECT a.id,a.action,a.target_type,a.target_id,a.details,a.created_at,u.email admin_email FROM admin_audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 100`);
    res.json({ events: rows.rows });
  } catch (error) { sendError(res, error); }
});

export default router;
