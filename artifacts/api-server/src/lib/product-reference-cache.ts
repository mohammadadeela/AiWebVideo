/**
 * Remembers what was read from a product link, so the same product is never read (and Chromium never started) twice in a
 * short time, and several people pasting one link at once share a single read.
 */

const TRACKING_PARAM = /^(?:utm_.+|gclid|gbraid|wbraid|fbclid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga|_gl|ref|ref_|referrer|cmpid|campaign|affid|sid)$/i;

/** The same product written two ways (tracking tags, #fragment, trailing slash, host case) is one key. */
export function normalizeProductUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    const kept = [...url.searchParams].filter(([key]) => !TRACKING_PARAM.test(key)).sort(([a], [b]) => a.localeCompare(b));
    url.search = '';
    for (const [key, value] of kept) url.searchParams.append(key, value);
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch { return raw.trim(); }
}

interface Entry<T> { value: T; expires: number }

/** A small in-memory TTL cache with a size cap; the oldest entries leave first. */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  constructor(private readonly ttlMs: number, private readonly max: number, private readonly now: () => number = Date.now) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) { this.entries.delete(key); return undefined; }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + ttlMs });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void { this.entries.clear(); }
  get size(): number { return this.entries.size; }
}

/** Shares one running read between callers asking for the same key. */
export class InFlight<T> {
  private readonly running = new Map<string, Promise<T>>();
  run(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.running.get(key);
    if (existing) return existing;
    const started = work().finally(() => { if (this.running.get(key) === started) this.running.delete(key); });
    this.running.set(key, started);
    return started;
  }
}
