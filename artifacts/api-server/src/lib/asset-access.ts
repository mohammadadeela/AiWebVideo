import { createHmac, timingSafeEqual } from 'node:crypto';

const ASSET_TTL_SECONDS = 6 * 60 * 60;
const SIGNING_SECRET = process.env.SESSION_SECRET ?? 'development-only-secret';
const LOCAL_ASSET_RE = /^\/api\/assets\/([0-9a-f-]{36})\/([a-z0-9][a-z0-9._-]{0,180})(?:\?.*)?$/i;

function signature(jobId: string, filename: string, expires: number) {
  return createHmac('sha256', SIGNING_SECRET)
    .update(`${jobId}:${filename}:${expires}`)
    .digest('hex');
}

/**
 * Generated user media is intentionally not a permanent public URL. The API
 * returns a short-lived signed URL that media elements can request without
 * exposing the bearer token in the URL or relying on custom video/image
 * headers. Marketing assets remain public and are not signed here.
 */
export function signPrivateAssetUrl(value: string, ttlSeconds = ASSET_TTL_SECONDS): string {
  const match = value.match(LOCAL_ASSET_RE);
  if (!match) return value;
  const [, jobId, filename] = match;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signature(jobId, filename, expires);
  return `/api/assets/${jobId}/${filename}?expires=${expires}&sig=${sig}`;
}

export function verifyPrivateAssetSignature(
  jobId: string,
  filename: string,
  expiresValue: unknown,
  signatureValue: unknown,
): boolean {
  if (typeof expiresValue !== 'string' || typeof signatureValue !== 'string') return false;
  if (!/^\d{10,13}$/.test(expiresValue) || !/^[0-9a-f]{64}$/i.test(signatureValue)) return false;
  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  // Do not accept signatures issued implausibly far into the future.
  if (expires > Math.floor(Date.now() / 1000) + ASSET_TTL_SECONDS + 60) return false;
  const expected = Buffer.from(signature(jobId, filename, expires), 'hex');
  const supplied = Buffer.from(signatureValue, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** Clone an API payload and sign every local, job-scoped asset reference in it. */
export function signAssetTree<T>(value: T): T {
  if (typeof value === 'string') return signPrivateAssetUrl(value) as T;
  if (Array.isArray(value)) return value.map((item) => signAssetTree(item)) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = signAssetTree(item);
    }
    return output as T;
  }
  return value;
}
