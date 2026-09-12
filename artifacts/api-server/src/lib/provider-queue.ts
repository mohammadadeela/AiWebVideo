import { query } from './pool.js';
import { logger } from './logger.js';
import {
  isPaidProviderReservationActive,
  type PaidGenerationSnapshot,
  type PaidGenerationStage,
} from './generation-authorization.js';

export type ProviderQueueKind = 'storyboard' | 'image' | 'video' | 'tts';

type QueueItem<T> = {
  id: number;
  kind: ProviderQueueKind;
  model: string;
  operation: string;
  jobId: string;
  ownerKey: string;
  enqueuedAt: number;
  rateLimitStartedAt: number | null;
  attempt: number;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type QueueState = {
  active: number;
  activeByOwner: Map<string, number>;
  starts: number[];
  blockedUntil: number;
  waiting: QueueItem<unknown>[];
  timer: NodeJS.Timeout | null;
  lastOwner: string | null;
};

export interface ProviderQueueSnapshot {
  key: string;
  model: string;
  kind: ProviderQueueKind;
  rpm: number;
  concurrency: number;
  waiting: number;
  active: number;
  blockedForMs: number;
}

const states = new Map<string, QueueState>();
let sequence = 0;
const ownerCache = new Map<string, { owner: string; expiresAt: number }>();

function envNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function queueSettings(kind: ProviderQueueKind) {
  const genericRpm = envNumber('GEMINI_DEFAULT_RPM', 30, 1, 10_000);
  const genericConcurrency = envNumber('GEMINI_DEFAULT_CONCURRENCY', 3, 1, 100);
  switch (kind) {
    case 'storyboard':
      return {
        rpm: envNumber('GEMINI_STORYBOARD_RPM', genericRpm, 1, 10_000),
        // Storyboard calls can contain several screenshots and therefore be
        // TPM-heavy even when there is only one website user. Default to one
        // in-flight planner request; operators can raise this after checking
        // the project's live Gemini limits in AI Studio.
        concurrency: envNumber('GEMINI_STORYBOARD_CONCURRENCY', 1, 1, 100),
      };
    case 'image':
      return {
        rpm: envNumber('GEMINI_IMAGE_RPM', 12, 1, 10_000),
        concurrency: envNumber('GEMINI_IMAGE_CONCURRENCY', 2, 1, 100),
      };
    case 'video':
      return {
        // Veo preview capacity is expensive and project/tier dependent. Keep
        // the existing 4 RPM pacing, but default to one submitted generation
        // at a time so multiple users cannot burst two paid Veo starts at once.
        // Operators can raise either value after checking the project's live
        // AI Studio limits.
        rpm: envNumber('GEMINI_VIDEO_RPM', 4, 1, 10_000),
        concurrency: envNumber('GEMINI_VIDEO_CONCURRENCY', 1, 1, 100),
      };
    case 'tts':
      return {
        rpm: envNumber('GEMINI_TTS_RPM', 20, 1, 10_000),
        concurrency: envNumber('GEMINI_TTS_CONCURRENCY', 2, 1, 100),
      };
  }
}

function queueKey(kind: ProviderQueueKind, model: string) {
  return `${kind}:${model}`;
}

function stateFor(kind: ProviderQueueKind, model: string) {
  const key = queueKey(kind, model);
  let state = states.get(key);
  if (!state) {
    state = { active: 0, activeByOwner: new Map(), starts: [], blockedUntil: 0, waiting: [], timer: null, lastOwner: null };
    states.set(key, state);
  }
  return state;
}

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try { return JSON.stringify(error); } catch { return String(error); }
}

function safeProviderErrorText(error: unknown) {
  // Gemini quota messages contain the useful metric/limit/retry information.
  // Keep enough for PM2 diagnostics while preventing pathological log spam.
  return errorText(error).replace(/\s+/g, ' ').trim().slice(0, 1_600);
}

/**
 * Only explicit throttling/quota responses are safe to automatically submit
 * again. A 503/UNAVAILABLE around an expensive generation start is ambiguous:
 * the provider may have accepted the operation before the connection failed,
 * so blindly re-submitting can create a duplicate paid video.
 */
function isRateLimitError(error: unknown) {
  const value = errorText(error);
  const status = Number((error as { status?: unknown; code?: unknown } | null)?.status ?? (error as { code?: unknown } | null)?.code);
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests/i.test(value);
}

/**
 * Quotas that cannot recover within a short retry window should not keep a
 * customer parked in an in-memory queue. The storyboard layer already has a
 * deterministic backup plan, so rejecting promptly lets production continue.
 */
function isClearlyLongLivedQuota(error: unknown) {
  const value = errorText(error);
  return /requests?_per_day|requests per day|daily quota|per[- ]day quota|quota[^\n]{0,100}limit:\s*0\b|limit:\s*0\b|billing[^\n]{0,80}(?:not enabled|required)|paid tier[^\n]{0,80}required/i.test(value);
}

function retryAfterFromProvider(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const headers = record.headers && typeof record.headers === 'object' ? record.headers as Record<string, unknown> : {};
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'] ?? record.retryAfter ?? record.retry_after;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(5 * 60_000, Math.max(1_000, Math.round(seconds * 1000)));
  }
  if (typeof retryAfter === 'string') {
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at) && at > Date.now()) {
      return Math.min(5 * 60_000, Math.max(1_000, at - Date.now()));
    }
  }
  const text = errorText(error);
  // Handles Google's common "Please retry in 35.602918266s" as well as
  // "retry after 30s"/"retryDelay 30s" variants.
  const match = text.match(/retry(?:\s+after|\s+in|Delay)?[^0-9]{0,12}(\d+(?:\.\d+)?)\s*s/i);
  if (match) return Math.min(5 * 60_000, Math.max(1_000, Math.round(Number(match[1]) * 1000)));
  return null;
}

function retryAfterMs(error: unknown, attempt: number, kind: ProviderQueueKind) {
  const providerDelay = retryAfterFromProvider(error);
  if (providerDelay != null) return providerDelay;

  // Video requests are both much more expensive and much more capacity-bound
  // than text/image calls. Back off substantially rather than hammering Veo.
  const backoff = kind === 'video'
    ? [20_000, 45_000, 90_000, 120_000, 180_000]
    : [5_000, 12_000, 25_000, 45_000, 75_000];
  const base = backoff[Math.min(attempt, backoff.length - 1)];
  // Small positive jitter prevents several queued users from waking and
  // re-hitting the project quota on the same millisecond.
  return Math.round(base * (1 + Math.random() * 0.15));
}

function maxRateLimitWaitMs(kind: ProviderQueueKind) {
  return kind === 'video'
    ? envNumber('GEMINI_VIDEO_QUEUE_MAX_WAIT_MS', 8 * 60_000, 30_000, 30 * 60_000)
    : envNumber('GEMINI_QUEUE_MAX_WAIT_MS', 5 * 60_000, 10_000, 30 * 60_000);
}

function maxRateLimitRetries(kind: ProviderQueueKind) {
  const generic = envNumber('GEMINI_QUEUE_RATE_LIMIT_RETRIES', 5, 0, 10);
  if (kind === 'storyboard') {
    // Repeating the same multimodal storyboard request five times does not fix
    // TPM/RPD/spend quota and only makes a single user wait. One short retry is
    // enough for a transient RPM race; then generateStoryboard falls back to
    // its built-in plan and the production keeps moving.
    return envNumber('GEMINI_STORYBOARD_QUEUE_RATE_LIMIT_RETRIES', 1, 0, 3);
  }
  return kind === 'video'
    ? envNumber('GEMINI_VIDEO_QUEUE_RATE_LIMIT_RETRIES', 4, 0, 10)
    : generic;
}

function maxStoryboardRetryDelayMs() {
  // If Google explicitly asks the planner to wait tens of seconds/minutes,
  // prefer the immediate built-in storyboard fallback rather than parking an
  // 8-second customer production before video generation has even started.
  return envNumber('GEMINI_STORYBOARD_MAX_RETRY_DELAY_MS', 8_000, 0, 60_000);
}

async function ownerForJob(jobId?: string) {
  if (!jobId) return 'anonymous';
  const cached = ownerCache.get(jobId);
  if (cached && cached.expiresAt > Date.now()) return cached.owner;
  try {
    const { rows } = await query<{ user_id: string | null }>('SELECT user_id FROM jobs WHERE id=$1 LIMIT 1', [jobId]);
    const owner = rows[0]?.user_id || `job:${jobId}`;
    ownerCache.set(jobId, { owner, expiresAt: Date.now() + 5 * 60_000 });
    if (ownerCache.size > 2_000) {
      const now = Date.now();
      for (const [key, value] of ownerCache) if (value.expiresAt <= now) ownerCache.delete(key);
    }
    return owner;
  } catch {
    return `job:${jobId}`;
  }
}

function providerStage(kind: ProviderQueueKind): PaidGenerationStage {
  return kind === 'storyboard' ? 'storyboarding' : 'rendering';
}

/** Re-check funding/cancellation after any queue wait and before every retry. */
async function assertQueuedProviderAuthorization(item: QueueItem<unknown>) {
  const { rows } = await query<PaidGenerationSnapshot & { cancel_requested: boolean }>(
    `SELECT user_id, status, credits_spent, cancel_requested
       FROM jobs
      WHERE id=$1 AND deleted_at IS NULL`,
    [item.jobId]
  );
  const snapshot = rows[0];
  const expectedStage = providerStage(item.kind);
  if (snapshot?.cancel_requested) {
    throw new Error(`Paid provider call cancelled before start for job ${item.jobId}.`);
  }
  if (!isPaidProviderReservationActive(snapshot, expectedStage)) {
    throw new Error(
      `Paid provider call blocked: job ${item.jobId} no longer has an active ${expectedStage} credit reservation.`
    );
  }
}

async function publishQueueStatus(item: QueueItem<unknown>, position: number, waitMs: number) {
  if (!item.jobId || waitMs < 600) return;
  const seconds = Math.max(1, Math.ceil(waitMs / 1000));
  const label = item.kind === 'video' ? 'video capacity' : item.kind === 'image' ? 'image capacity' : item.kind === 'tts' ? 'audio capacity' : 'AI capacity';
  await query(
    `UPDATE jobs
     SET status_message=$2, eta_seconds=GREATEST(COALESCE(eta_seconds,0),$3), updated_at=NOW()
     WHERE id=$1 AND status NOT IN ('done','failed','cancelled')`,
    [item.jobId, `Queued for ${label} · position ${position}`, seconds],
  ).catch(() => {});
}

async function publishProviderThrottleStatus(item: QueueItem<unknown>, waitMs: number) {
  if (!item.jobId) return;
  const seconds = Math.max(1, Math.ceil(waitMs / 1000));
  const message = item.kind === 'storyboard'
    ? `Gemini temporarily limited AI planning · retrying in ${seconds}s`
    : `Provider temporarily limited ${item.kind} capacity · retrying in ${seconds}s`;
  await query(
    `UPDATE jobs
     SET status_message=$2, eta_seconds=GREATEST(COALESCE(eta_seconds,0),$3), updated_at=NOW()
     WHERE id=$1 AND status NOT IN ('done','failed','cancelled')`,
    [item.jobId, message, seconds],
  ).catch(() => {});
}

async function publishStoryboardFallbackStatus(item: QueueItem<unknown>) {
  if (!item.jobId || item.kind !== 'storyboard') return;
  await query(
    `UPDATE jobs
     SET status_message='Gemini planning capacity is limited · continuing with the backup plan',
         eta_seconds=LEAST(GREATEST(COALESCE(eta_seconds,0),5),15),
         updated_at=NOW()
     WHERE id=$1 AND status NOT IN ('done','failed','cancelled')`,
    [item.jobId],
  ).catch(() => {});
}

function cleanupStarts(state: QueueState, now: number) {
  const cutoff = now - 60_000;
  while (state.starts.length && state.starts[0] <= cutoff) state.starts.shift();
}

function nextDelay(state: QueueState, rpm: number, now: number) {
  cleanupStarts(state, now);
  const blocked = Math.max(0, state.blockedUntil - now);
  if (state.starts.length < rpm) return blocked;
  return Math.max(blocked, Math.max(10, state.starts[0] + 60_000 - now));
}

function pickFairItem(state: QueueState, perOwnerConcurrency: number) {
  if (!state.waiting.length) return -1;
  const availableIndexes = state.waiting
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => (state.activeByOwner.get(item.ownerKey) ?? 0) < perOwnerConcurrency);
  if (!availableIndexes.length) return -1;
  const different = availableIndexes.find(({ item }) => item.ownerKey !== state.lastOwner);
  return (different ?? availableIndexes[0]).index;
}

function schedule(kind: ProviderQueueKind, model: string, delayMs: number) {
  const state = stateFor(kind, model);
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    void drain(kind, model);
  }, Math.max(10, delayMs));
  state.timer.unref?.();
}

async function drain(kind: ProviderQueueKind, model: string) {
  const state = stateFor(kind, model);
  const { rpm, concurrency } = queueSettings(kind);
  const perOwnerConcurrency = Math.max(1, envNumber('GEMINI_PER_USER_CONCURRENCY', 2, 1, 20));
  const now = Date.now();
  cleanupStarts(state, now);

  if (!state.waiting.length) return;
  const delay = nextDelay(state, rpm, now);
  if (delay > 0) {
    for (let i = 0; i < Math.min(3, state.waiting.length); i += 1) {
      void publishQueueStatus(state.waiting[i], i + 1, delay);
    }
    schedule(kind, model, delay);
    return;
  }

  while (state.active < concurrency && state.waiting.length && state.starts.length < rpm && Date.now() >= state.blockedUntil) {
    const index = pickFairItem(state, perOwnerConcurrency);
    if (index < 0) break;
    const [item] = state.waiting.splice(index, 1);
    state.active += 1;
    state.activeByOwner.set(item.ownerKey, (state.activeByOwner.get(item.ownerKey) ?? 0) + 1);
    state.lastOwner = item.ownerKey;
    state.starts.push(Date.now());

    void assertQueuedProviderAuthorization(item)
      .then(() => item.task())
      .then(
        (value) => item.resolve(value),
        (error) => {
          const rateLimited = isRateLimitError(error);
          const maxRetries = maxRateLimitRetries(kind);
          if (rateLimited) {
            const providerDelayMs = retryAfterFromProvider(error);
            const delayMs = retryAfterMs(error, item.attempt, kind);
            const clearlyLongLived = isClearlyLongLivedQuota(error);
            const storyboardDelayTooLong =
              kind === 'storyboard' && providerDelayMs != null && providerDelayMs > maxStoryboardRetryDelayMs();
            const canRetry = item.attempt < maxRetries && !clearlyLongLived && !storyboardDelayTooLong;

            logger.warn(
              {
                kind,
                model,
                operation: item.operation,
                jobId: item.jobId,
                providerError: safeProviderErrorText(error),
                providerRetryAfterMs: providerDelayMs,
                delayMs: canRetry ? delayMs : 0,
                attempt: item.attempt + 1,
                maxRetries,
                clearlyLongLived,
                storyboardDelayTooLong,
              },
              canRetry
                ? '[provider-queue] provider throttled request; retrying with safe backoff'
                : '[provider-queue] provider quota unavailable; not parking job in retry queue',
            );

            if (canRetry) {
              const now = Date.now();
              const rateLimitStartedAt = item.rateLimitStartedAt ?? now;
              item.rateLimitStartedAt = rateLimitStartedAt;
              const throttledWaitAfterDelay = now + delayMs - rateLimitStartedAt;
              if (throttledWaitAfterDelay > maxRateLimitWaitMs(kind)) {
                void publishStoryboardFallbackStatus(item);
                item.reject(new Error(
                  `Provider ${kind} capacity stayed rate-limited beyond the safe retry window. ${safeProviderErrorText(error)}`,
                ));
              } else {
                item.attempt += 1;
                item.enqueuedAt = now;
                state.blockedUntil = Math.max(state.blockedUntil, now + delayMs);
                state.waiting.push(item);
                void publishProviderThrottleStatus(item, delayMs);
              }
            } else {
              void publishStoryboardFallbackStatus(item);
              item.reject(error);
            }
          } else {
            item.reject(error);
          }
        },
      ).finally(() => {
        state.active = Math.max(0, state.active - 1);
        const ownerActive = Math.max(0, (state.activeByOwner.get(item.ownerKey) ?? 1) - 1);
        if (ownerActive) state.activeByOwner.set(item.ownerKey, ownerActive); else state.activeByOwner.delete(item.ownerKey);
        void drain(kind, model);
      });
  }

  if (state.waiting.length) {
    const wait = nextDelay(state, rpm, Date.now());
    if (wait > 0) schedule(kind, model, wait);
  }
}

export async function runQueuedProviderCall<T>(input: {
  kind: ProviderQueueKind;
  model: string;
  operation: string;
  jobId: string;
  task: () => Promise<T>;
}): Promise<T> {
  const ownerKey = await ownerForJob(input.jobId);
  const state = stateFor(input.kind, input.model);
  return new Promise<T>((resolve, reject) => {
    const now = Date.now();
    const item: QueueItem<T> = {
      id: ++sequence,
      kind: input.kind,
      model: input.model,
      operation: input.operation,
      jobId: input.jobId,
      ownerKey,
      enqueuedAt: now,
      rateLimitStartedAt: null,
      attempt: 0,
      task: input.task,
      resolve,
      reject,
    };
    state.waiting.push(item as QueueItem<unknown>);
    if (state.waiting.length > 1) {
      const wait = nextDelay(state, queueSettings(input.kind).rpm, Date.now());
      void publishQueueStatus(item as QueueItem<unknown>, state.waiting.length, Math.max(wait, 1_000));
    }
    void drain(input.kind, input.model);
  });
}

export function getProviderQueueSnapshot(): ProviderQueueSnapshot[] {
  const now = Date.now();
  return Array.from(states.entries()).map(([key, state]) => {
    const separator = key.indexOf(':');
    const kind = key.slice(0, separator) as ProviderQueueKind;
    const model = key.slice(separator + 1);
    const settings = queueSettings(kind);
    return {
      key,
      kind,
      model,
      rpm: settings.rpm,
      concurrency: settings.concurrency,
      waiting: state.waiting.length,
      active: state.active,
      blockedForMs: Math.max(0, state.blockedUntil - now),
    };
  });
}
