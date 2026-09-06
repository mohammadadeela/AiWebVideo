import { query } from './pool.js';
import { logger } from './logger.js';

export type ProviderQueueKind = 'storyboard' | 'image' | 'video' | 'tts';

type QueueItem<T> = {
  id: number;
  kind: ProviderQueueKind;
  model: string;
  operation: string;
  jobId?: string;
  ownerKey: string;
  enqueuedAt: number;
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
        concurrency: envNumber('GEMINI_STORYBOARD_CONCURRENCY', genericConcurrency, 1, 100),
      };
    case 'image':
      return {
        rpm: envNumber('GEMINI_IMAGE_RPM', 12, 1, 10_000),
        concurrency: envNumber('GEMINI_IMAGE_CONCURRENCY', 2, 1, 100),
      };
    case 'video':
      return {
        rpm: envNumber('GEMINI_VIDEO_RPM', 4, 1, 10_000),
        concurrency: envNumber('GEMINI_VIDEO_CONCURRENCY', 2, 1, 100),
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

function isRateLimitError(error: unknown) {
  const value = errorText(error);
  const status = Number((error as { status?: unknown; code?: unknown } | null)?.status ?? (error as { code?: unknown } | null)?.code);
  return status === 429 || status === 503 || /429|RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests|UNAVAILABLE|temporar(?:y|ily) unavailable/i.test(value);
}

function retryAfterMs(error: unknown, attempt: number) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const headers = record.headers && typeof record.headers === 'object' ? record.headers as Record<string, unknown> : {};
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'] ?? record.retryAfter ?? record.retry_after;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(120_000, Math.max(1_000, Math.round(seconds * 1000)));
  const text = errorText(error);
  const match = text.match(/retry(?:\s+after|Delay)?[^0-9]{0,12}(\d+(?:\.\d+)?)\s*s/i);
  if (match) return Math.min(120_000, Math.max(1_000, Math.round(Number(match[1]) * 1000)));
  const backoff = [5_000, 12_000, 25_000, 45_000, 75_000];
  return backoff[Math.min(attempt, backoff.length - 1)];
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

    void item.task().then(
      (value) => item.resolve(value),
      (error) => {
        const maxRetries = envNumber('GEMINI_QUEUE_RATE_LIMIT_RETRIES', 5, 0, 10);
        if (item.attempt < maxRetries && isRateLimitError(error)) {
          const delayMs = retryAfterMs(error, item.attempt);
          item.attempt += 1;
          item.enqueuedAt = Date.now();
          state.blockedUntil = Math.max(state.blockedUntil, Date.now() + delayMs);
          state.waiting.push(item);
          logger.warn({ kind, model, operation: item.operation, jobId: item.jobId, delayMs, attempt: item.attempt }, '[provider-queue] provider rate limited; queued for retry');
          void publishQueueStatus(item, state.waiting.length, delayMs);
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
  jobId?: string;
  task: () => Promise<T>;
}): Promise<T> {
  const ownerKey = await ownerForJob(input.jobId);
  const state = stateFor(input.kind, input.model);
  return new Promise<T>((resolve, reject) => {
    const item: QueueItem<T> = {
      id: ++sequence,
      kind: input.kind,
      model: input.model,
      operation: input.operation,
      jobId: input.jobId,
      ownerKey,
      enqueuedAt: Date.now(),
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
