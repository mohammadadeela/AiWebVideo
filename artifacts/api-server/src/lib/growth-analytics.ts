import { query } from './pool.js';

export type GrowthEvent = {
  event: string; sessionId?: string | null; path?: string | null; referrer?: string | null;
  landingPage?: string | null; deviceClass?: string | null; utmSource?: string | null;
  utmMedium?: string | null; utmCampaign?: string | null; metadata?: Record<string, unknown> | null;
};

let schemaPromise: Promise<void> | null = null;

export function ensureGrowthAnalyticsSchema(): Promise<void> {
  schemaPromise ??= query(`CREATE TABLE IF NOT EXISTS growth_events (
    id BIGSERIAL PRIMARY KEY, event TEXT NOT NULL, session_id TEXT, path TEXT, referrer TEXT,
    landing_page TEXT, device_class TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
    metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ); CREATE INDEX IF NOT EXISTS growth_events_event_created_idx ON growth_events(event, created_at DESC);
  CREATE INDEX IF NOT EXISTS growth_events_session_created_idx ON growth_events(session_id, created_at DESC);`)
    .then(() => undefined).catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

export async function recordGrowthEvent(event: GrowthEvent): Promise<void> {
  await ensureGrowthAnalyticsSchema();
  await query(`INSERT INTO growth_events
    (event,session_id,path,referrer,landing_page,device_class,utm_source,utm_medium,utm_campaign,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [
    event.event.slice(0, 80), event.sessionId?.slice(0, 180) ?? null, event.path?.slice(0, 500) ?? null,
    event.referrer?.slice(0, 1000) ?? null, event.landingPage?.slice(0, 500) ?? null, event.deviceClass?.slice(0, 30) ?? null,
    event.utmSource?.slice(0, 180) ?? null, event.utmMedium?.slice(0, 180) ?? null, event.utmCampaign?.slice(0, 180) ?? null,
    event.metadata ? JSON.stringify(event.metadata).slice(0, 10000) : null,
  ]);
}

export async function getGrowthFunnel(periodStart: Date | null): Promise<Record<string, unknown>> {
  await ensureGrowthAnalyticsSchema();
  const where = periodStart ? 'WHERE created_at >= $1' : '';
  const values = periodStart ? [periodStart] : [];
  const { rows } = await query<Record<string, unknown>>(`SELECT event, COUNT(*)::int events, COUNT(DISTINCT NULLIF(session_id,''))::int sessions FROM growth_events ${where} GROUP BY event ORDER BY event`, values);
  const counts = Object.fromEntries(rows.map((row) => [String(row.event), Number(row.events ?? 0)]));
  const funnelEvents = ['page_view','hero_cta_click','url_entered','website_capture_completed','website_preview_viewed','auth_completed','creation_started','quote_shown','paywall_shown','checkout_started','checkout_success','generation_started','generation_completed','download_clicked','repeat_creation_started'];
  const funnel = funnelEvents.map((event, index) => {
    const count = Number(counts[event] ?? 0); const previous = index === 0 ? null : Number(counts[funnelEvents[index - 1]] ?? 0);
    return { event, count, conversionFromPrevious: previous && previous > 0 ? (count / previous) * 100 : null };
  });
  return { counts, funnel, totalEvents: rows.reduce((sum, row) => sum + Number(row.events ?? 0), 0) };
}