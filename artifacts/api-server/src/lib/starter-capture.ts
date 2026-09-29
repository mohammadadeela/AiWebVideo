import { pool } from './pool.js';
import { STARTER_CREDITS_INTERNAL } from './growth-offers.js';

/** Reserve one site read before starting Playwright. Only a useful result settles it. */
export async function reserveCapture(jobId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const starter = await client.query(`UPDATE users SET starter_credits_balance=starter_credits_balance-$1,updated_at=NOW()
      WHERE id=$2 AND starter_credits_balance >= $1 RETURNING id`, [STARTER_CREDITS_INTERNAL, userId]);
    const source = starter.rowCount ? 'starter' : 'production';
    if (!starter.rowCount) {
      const paid = await client.query(`UPDATE users SET credits_balance=credits_balance-$1,updated_at=NOW()
        WHERE id=$2 AND credits_balance >= $1 RETURNING id`, [STARTER_CREDITS_INTERNAL, userId]);
      if (!paid.rowCount) { await client.query('ROLLBACK'); return false; }
    }
    await client.query(`INSERT INTO starter_capture_reservations(job_id,user_id,amount,source,status)
      VALUES($1,$2,$3,$4,'reserved')`, [jobId,userId,STARTER_CREDITS_INTERNAL,source]);
    if (source === 'production') await client.query(`INSERT INTO credit_transactions(user_id,job_id,delta,reason)
      VALUES($1,$2,$3,'Website capture')`, [userId,jobId,-STARTER_CREDITS_INTERNAL]);
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

/** Atomic and idempotent; a failed or cancelled read restores its original balance. */
export async function settleCapture(jobId: string, success: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ user_id: string; amount: number; source: string; status: string }>(
      'SELECT user_id,amount,source,status FROM starter_capture_reservations WHERE job_id=$1 FOR UPDATE', [jobId]);
    const reservation = result.rows[0];
    if (!reservation || reservation.status !== 'reserved') { await client.query('ROLLBACK'); return; }
    if (!success) {
      const column = reservation.source === 'starter' ? 'starter_credits_balance' : 'credits_balance';
      await client.query(`UPDATE users SET ${column}=${column}+$1,updated_at=NOW() WHERE id=$2`,
        [reservation.amount,reservation.user_id]);
      if (reservation.source === 'production') await client.query(`INSERT INTO credit_transactions(user_id,job_id,delta,reason)
        VALUES($1,$2,$3,'Website capture refund')`, [reservation.user_id,jobId,reservation.amount]);
    }
    await client.query('UPDATE starter_capture_reservations SET status=$2,updated_at=NOW() WHERE job_id=$1',
      [jobId,success ? 'consumed' : 'refunded']);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
