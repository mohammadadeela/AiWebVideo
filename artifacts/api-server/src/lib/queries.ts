import { pool, query } from './pool.js';

export interface UserRow {
  id: string;
  email: string;
  firebase_uid: string | null;
  plan: string;
  credits_balance: number;
  stripe_customer_id: string | null;
  password_hash: string | null;
  is_admin: boolean;
  account_status: string;
  email_verified: boolean;
  created_at: Date;
}

export interface JobRow {
  id: string;
  user_id: string | null;
  source_url: string;
  status: string;
  progress: number;
  mode: string;
  vibe_brief: string | null;
  capture_metadata: Record<string, unknown> | null;
  storyboard: Record<string, unknown> | null;
  workflow_state: Record<string, unknown> | null;
  status_message: string | null;
  eta_seconds: number | null;
  credits_spent: number;
  error_message: string | null;
  title: string | null;
  pinned: boolean;
  deleted_at: Date | null;
  parent_job_id: string | null;
  cancel_requested: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AssetRow {
  id: string;
  job_id: string;
  type: string;
  storage_url: string;
  aspect_ratio: string | null;
  watermarked: boolean;
  downloadable: boolean;
  created_at: Date;
}

export interface JobMessageRow {
  id: string;
  job_id: string;
  role: 'user' | 'assistant' | 'system';
  kind: string;
  content: string;
  payload: Record<string, unknown> | null;
  created_at: Date;
}

// ---- Users ----

export async function getOrCreateUser(
  firebaseUid: string,
  email: string,
  adminEmail?: string
): Promise<UserRow> {
  const isAdmin = adminEmail && email.toLowerCase() === adminEmail.toLowerCase();
  const { rows } = await query<UserRow>(
    `INSERT INTO users (firebase_uid, email, plan, credits_balance, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (firebase_uid) DO UPDATE
       SET email = EXCLUDED.email, is_admin = users.is_admin OR EXCLUDED.is_admin
     RETURNING *`,
    [firebaseUid, email, isAdmin ? 'agency' : 'free', isAdmin ? 999999 : 0, Boolean(isAdmin)]
  );
  const user = rows[0];
  // If admin and not already on agency/999999, upgrade
  if (isAdmin && (user.plan !== 'agency' || user.credits_balance < 999999)) {
    const { rows: upgraded } = await query<UserRow>(
      `UPDATE users SET plan='agency', credits_balance=999999, is_admin=TRUE WHERE id=$1 RETURNING *`,
      [user.id]
    );
    return upgraded[0];
  }
  return user;
}

export async function getUserByLocalAuth(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE email=$1 LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE id=$1 LIMIT 1', [id]);
  return rows[0] ?? null;
}

export async function createLocalUser(
  email: string,
  passwordHash: string,
  adminEmail?: string,
  emailVerified = false
): Promise<UserRow> {
  const isAdmin = adminEmail && email.toLowerCase() === adminEmail.toLowerCase();
  const localIdentity = `local:${email.toLowerCase()}`;
  const { rows } = await query<UserRow>(
    `INSERT INTO users (firebase_uid, email, password_hash, plan, credits_balance, is_admin, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, is_admin=users.is_admin OR EXCLUDED.is_admin
     RETURNING *`,
    [localIdentity, email, passwordHash, isAdmin ? 'agency' : 'free', isAdmin ? 999999 : 0, Boolean(isAdmin), emailVerified]
  );
  return rows[0];
}

// ---- Email verification (pending sign-ups) ----

export interface PendingVerificationRow {
  id: string;
  email: string;
  password_hash: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  created_at: Date;
}

/** Creates (or replaces) the pending verification row for an email, resetting attempts. */
export async function upsertPendingVerification(
  email: string,
  passwordHash: string,
  codeHash: string,
  expiresAt: Date
): Promise<PendingVerificationRow> {
  const { rows } = await query<PendingVerificationRow>(
    `INSERT INTO pending_verifications (email, password_hash, code_hash, attempts, expires_at)
     VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, code_hash = EXCLUDED.code_hash,
           attempts = 0, expires_at = EXCLUDED.expires_at, created_at = NOW()
     RETURNING *`,
    [email, passwordHash, codeHash, expiresAt]
  );
  return rows[0];
}

export async function getPendingVerification(email: string): Promise<PendingVerificationRow | null> {
  const { rows } = await query<PendingVerificationRow>('SELECT * FROM pending_verifications WHERE email=$1 LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function bumpVerificationAttempts(email: string): Promise<number> {
  const { rows } = await query<{ attempts: number }>(
    'UPDATE pending_verifications SET attempts = attempts + 1 WHERE email=$1 RETURNING attempts',
    [email]
  );
  return rows[0]?.attempts ?? 0;
}

export async function deletePendingVerification(email: string): Promise<void> {
  await query('DELETE FROM pending_verifications WHERE email=$1', [email]);
}

/** Attaches an anonymous (guest) job to a newly authenticated account, once, if it isn't owned yet. */
export async function claimJob(jobId: string, userId: string): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    'UPDATE jobs SET user_id=$1, updated_at=NOW() WHERE id=$2 AND user_id IS NULL AND deleted_at IS NULL RETURNING id',
    [userId, jobId]
  );
  return rows.length > 0;
}

export async function spendCredits(userId: string, amount: number): Promise<number | null> {
  const { rows } = await query<{ credits_balance: number }>(
    `UPDATE users SET credits_balance = credits_balance - $1
     WHERE id = $2 AND credits_balance >= $1
     RETURNING credits_balance`,
    [amount, userId]
  );
  return rows[0]?.credits_balance ?? null;
}

export type RenderClaimResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'not_found' | 'not_owner' | 'already_started' | 'already_failed' | 'insufficient_credits' };

/**
 * Atomically claims a job and charges it once, preventing double-click billing.
 *
 * A job whose *previous* render attempt already failed is deliberately
 * blocked here too (not just 'rendering'/'done'). Without this, a client
 * retrying the same job id after a failed render would re-execute the exact
 * same already-generated storyboard (same scenes, same crops, same variant
 * seed) and could appear to "regenerate the same video." Storyboard-planning
 * failures never reach this function in the first place (no storyboard was
 * ever saved, so the render route already rejects with STORYBOARD_NOT_READY
 * before calling this), so this only closes the render-retry loophole.
 */
export async function claimRenderAndSpend(jobId: string, userId: string, amount: number): Promise<RenderClaimResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: jobs } = await client.query<{ user_id: string | null; status: string }>(
      'SELECT user_id, status FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
    );
    const job = jobs[0];
    if (!job) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }
    if (job.user_id && job.user_id !== userId) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_owner' };
    }
    if (job.status === 'rendering' || job.status === 'done') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already_started' };
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already_failed' };
    }
    const { rows: users } = await client.query<{ credits_balance: number }>(
      `UPDATE users SET credits_balance=credits_balance-$1, updated_at=NOW()
       WHERE id=$2 AND credits_balance >= $1 RETURNING credits_balance`,
      [amount, userId]
    );
    if (!users[0]) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'insufficient_credits' };
    }
    await client.query(
      `UPDATE jobs SET user_id=$1, status='rendering', progress=80, credits_spent=$3, error_message=NULL, updated_at=NOW()
       WHERE id=$2`,
      [userId, jobId, amount]
    );
    await client.query(
      'INSERT INTO credit_transactions (user_id, delta, reason) VALUES ($1,$2,$3)',
      [userId, -amount, `Render ${jobId}`]
    );
    await client.query('COMMIT');
    return { ok: true, remaining: users[0].credits_balance };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function refundCredits(userId: string, amount: number, reason: string): Promise<void> {
  if (amount <= 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE users SET credits_balance=credits_balance+$1, updated_at=NOW() WHERE id=$2',
      [amount, userId]
    );
    await client.query(
      'INSERT INTO credit_transactions (user_id, delta, reason) VALUES ($1,$2,$3)',
      [userId, amount, reason]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Refunds only credits still reserved by this job, atomically with job state. */
export async function refundJobCredits(
  jobId: string,
  userId: string,
  requestedAmount: number,
  reason: string,
): Promise<number> {
  if (requestedAmount <= 0) return 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ user_id: string | null; credits_spent: number }>(
      'SELECT user_id, credits_spent FROM jobs WHERE id=$1 FOR UPDATE',
      [jobId],
    );
    const job = rows[0];
    if (!job || job.user_id !== userId || job.credits_spent <= 0) {
      await client.query('ROLLBACK');
      return 0;
    }
    const amount = Math.min(requestedAmount, job.credits_spent);
    await client.query(
      'UPDATE users SET credits_balance=credits_balance+$1, updated_at=NOW() WHERE id=$2',
      [amount, userId],
    );
    await client.query(
      'INSERT INTO credit_transactions (user_id, delta, reason) VALUES ($1,$2,$3)',
      [userId, amount, reason],
    );
    await client.query(
      'UPDATE jobs SET credits_spent=credits_spent-$1, updated_at=NOW() WHERE id=$2',
      [amount, jobId],
    );
    await client.query('COMMIT');
    return amount;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---- Jobs ----

export async function createJob(
  userId: string | null,
  sourceUrl: string,
  mode: string = 'video'
): Promise<JobRow> {
  const { rows } = await query<JobRow>(
    `INSERT INTO jobs (user_id, source_url, status, progress, mode, status_message, eta_seconds)
     VALUES ($1, $2, 'capturing', 5, $3, 'Preparing secure website capture', 240) RETURNING *`,
    [userId, sourceUrl, mode]
  );
  return rows[0];
}

export async function createJobFromCapture(userId: string, source: JobRow): Promise<JobRow> {
  const metadata = source.capture_metadata
    ? JSON.parse(JSON.stringify(source.capture_metadata).replaceAll(source.id, '__NEW_JOB_ID__')) as Record<string, unknown>
    : null;
  const { rows } = await query<JobRow>(
    `INSERT INTO jobs
      (user_id, source_url, status, progress, mode, status_message, eta_seconds, capture_metadata, title, parent_job_id)
     VALUES ($1,$2,'captured',40,'video','Saved website capture ready',0,$3,$4,$5)
     RETURNING *`,
    [userId, source.source_url, metadata, source.title, source.id]
  );
  const job = rows[0];
  let result = job;
  if (metadata) {
    const corrected = JSON.parse(JSON.stringify(metadata).replaceAll('__NEW_JOB_ID__', job.id)) as Record<string, unknown>;
    result = (await updateJob(job.id, { capture_metadata: corrected })) ?? job;
  }
  // A reused capture is a new creative conversation/version. Do not clone the
  // previous transcript, storyboard/render messages, or result chatter into it.
  // The reuse route adds one concise provenance message instead.
  return result;
}

/**
 * Create a job directly from user-uploaded photos, bypassing the website
 * capture (Playwright) step entirely. Lands in 'captured' status with
 * capture_metadata already populated in the exact same shape the website
 * capture flow produces (a title + a `pages` array of {url, title,
 * screenshotUrl}), so every downstream consumer — the storyboard planner,
 * loadReferenceCaptures() in jobs.ts, the frontend's existing "capturing ->
 * awaiting_mode" polling transition — needs zero special-casing for uploads.
 */
export async function createUploadJob(
  userId: string | null,
  title: string,
  captureMetadata: Record<string, unknown>,
): Promise<JobRow> {
  const { rows } = await query<JobRow>(
    `INSERT INTO jobs
      (user_id, source_url, status, progress, mode, status_message, eta_seconds, capture_metadata, title)
     VALUES ($1,$2,'captured',40,'video','Your uploaded photos are ready',0,$3,$4)
     RETURNING *`,
    [userId, `upload://${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'photos'}`, captureMetadata, title]
  );
  return rows[0];
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<JobRow, 'status' | 'progress' | 'mode' | 'vibe_brief' | 'capture_metadata' | 'storyboard' | 'workflow_state' | 'status_message' | 'eta_seconds' | 'credits_spent' | 'error_message' | 'title' | 'pinned' | 'deleted_at' | 'cancel_requested'>>
): Promise<JobRow | null> {
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, val] of Object.entries(patch)) {
    sets.push(`${key} = $${i++}`);
    values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
  }
  values.push(id);
  const { rows } = await query<JobRow>(
    `UPDATE jobs SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { rows } = await query<JobRow>('SELECT * FROM jobs WHERE id=$1 LIMIT 1', [id]);
  return rows[0] ?? null;
}

const CANCELLABLE_STATUSES = new Set(['queued', 'capturing', 'storyboarding', 'rendering']);

export type CancelResult =
  | { ok: true; immediate: boolean } // immediate=true means it was 'queued' with nothing running/charged yet
  | { ok: false; reason: 'not_found' | 'not_owner' | 'not_cancellable' };

/**
 * Flags a job for cooperative cancellation. The in-flight capture/storyboard/
 * render loop is responsible for checking this flag between steps, refunding
 * any credits it already spent, and settling the job as 'cancelled' — this
 * function only records the request and handles the trivial case (nothing
 * has started yet) synchronously.
 */
export async function requestJobCancellation(jobId: string, userId: string): Promise<CancelResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<Pick<JobRow, 'user_id' | 'status' | 'credits_spent'>>(
      'SELECT user_id, status, credits_spent FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
    );
    const job = rows[0];
    if (!job) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_found' }; }
    if (job.user_id && job.user_id !== userId) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_owner' }; }
    if (!CANCELLABLE_STATUSES.has(job.status)) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_cancellable' }; }

    if (job.status === 'queued') {
      // Nothing is running and nothing has been charged yet — settle immediately.
      await client.query(
        `UPDATE jobs SET status='cancelled', cancel_requested=TRUE, status_message='Cancelled', eta_seconds=0, updated_at=NOW() WHERE id=$1`,
        [jobId]
      );
      await client.query('COMMIT');
      return { ok: true, immediate: true };
    }

    await client.query(`UPDATE jobs SET cancel_requested=TRUE, updated_at=NOW() WHERE id=$1`, [jobId]);
    await client.query('COMMIT');
    return { ok: true, immediate: false };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function isCancelRequested(jobId: string): Promise<boolean> {
  const { rows } = await query<{ cancel_requested: boolean }>('SELECT cancel_requested FROM jobs WHERE id=$1', [jobId]);
  return rows[0]?.cancel_requested ?? false;
}

/** A process restart interrupts in-memory work; never leave those jobs spinning forever. */
export async function recoverInterruptedJobs(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<Pick<JobRow, 'id' | 'user_id' | 'status' | 'credits_spent'>>(
      `SELECT id, user_id, status, credits_spent FROM jobs
       WHERE status IN ('queued','capturing','storyboarding','rendering') FOR UPDATE`
    );
    for (const job of rows) {
      if (job.status === 'rendering' && job.user_id && job.credits_spent > 0) {
        await client.query(
          'UPDATE users SET credits_balance=credits_balance+$1, updated_at=NOW() WHERE id=$2',
          [job.credits_spent, job.user_id]
        );
        await client.query(
          'INSERT INTO credit_transactions (user_id, delta, reason) VALUES ($1,$2,$3)',
          [job.user_id, job.credits_spent, `Interrupted render refund ${job.id}`]
        );
      }
    }
    if (rows.length) {
      await client.query(
        `UPDATE jobs
         SET status='failed', progress=0, eta_seconds=0, credits_spent=0,
             status_message='The previous attempt was interrupted',
             error_message='That attempt was interrupted before it finished. Any reserved credits were restored; please start it again.',
             updated_at=NOW()
         WHERE id = ANY($1::uuid[])`,
        [rows.map((job) => job.id)]
      );
    }
    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getJobsByUser(userId: string, limit = 20): Promise<JobRow[]> {
  const { rows } = await query<JobRow>(
    `SELECT * FROM jobs
     WHERE user_id=$1 AND deleted_at IS NULL
     ORDER BY pinned DESC, updated_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function addJobMessage(
  jobId: string,
  role: JobMessageRow['role'],
  content: string,
  kind = 'text',
  payload?: Record<string, unknown> | null,
): Promise<JobMessageRow> {
  const { rows } = await query<JobMessageRow>(
    `INSERT INTO job_messages (job_id, role, kind, content, payload)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [jobId, role, kind, content, payload ? JSON.stringify(payload) : null]
  );
  await query('UPDATE jobs SET updated_at=NOW() WHERE id=$1', [jobId]);
  return rows[0];
}

export async function getJobMessages(jobId: string): Promise<JobMessageRow[]> {
  const { rows } = await query<JobMessageRow>(
    'SELECT * FROM job_messages WHERE job_id=$1 ORDER BY created_at ASC',
    [jobId]
  );
  return rows;
}

export async function softDeleteJob(jobId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE jobs SET deleted_at=NOW(), pinned=FALSE, updated_at=NOW() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
    [jobId, userId]
  );
  return (rowCount ?? 0) > 0;
}

// ---- Assets ----

export async function createAsset(
  jobId: string,
  type: string,
  storageUrl: string,
  aspectRatio: string | null,
  watermarked: boolean,
  downloadable: boolean
): Promise<AssetRow> {
  const { rows } = await query<AssetRow>(
    `INSERT INTO assets (job_id, type, storage_url, aspect_ratio, watermarked, downloadable)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [jobId, type, storageUrl, aspectRatio, watermarked, downloadable]
  );
  return rows[0];
}

export async function getAssetsByJob(jobId: string): Promise<AssetRow[]> {
  // Explicit ordering matters: the UI shows the most recently created video
  // as "the" result, and without ORDER BY, Postgres does not guarantee row
  // order is insertion order.
  const { rows } = await query<AssetRow>('SELECT * FROM assets WHERE job_id=$1 ORDER BY created_at ASC, id ASC', [jobId]);
  return rows;
}
