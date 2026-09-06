import { pool } from './pool.js';

/** Atomically grants purchased credits once and attaches the plan to the same account. */
export async function grantCreditsOnce(input: { key: string; userId: string; credits: number; plan?: string | null; reason: string }): Promise<boolean> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO credit_grants(grant_key,user_id,credits,plan,reason) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING grant_key`,
      [input.key, input.userId, input.credits, input.plan ?? null, input.reason],
    );
    if (!inserted.rowCount) { await client.query('ROLLBACK'); return false; }
    const updated = await client.query<{ credits_balance: number }>(
      `UPDATE users SET credits_balance=credits_balance+$1, plan=COALESCE($2,plan), updated_at=NOW() WHERE id=$3 RETURNING credits_balance`,
      [input.credits, input.plan ?? null, input.userId],
    );
    if (!updated.rowCount) throw new Error('Credit grant target user no longer exists.');
    await client.query(`INSERT INTO credit_transactions(user_id,delta,reason) VALUES ($1,$2,$3)`, [input.userId, input.credits, input.reason]);
    await client.query('COMMIT');
    console.info(`[credits] grant user=${input.userId} amount=${input.credits} balance=${updated.rows[0]?.credits_balance ?? 'unknown'} key=${input.key}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
