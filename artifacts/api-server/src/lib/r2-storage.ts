import { createHash, createHmac } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const LOCAL_ASSETS_DIR = process.env.ASSETS_DIR ?? '/tmp/aiwebvideo-assets';
const DEFAULT_PREFIX = 'aiwebvideo';
const SERVICE = 's3';
const REGION = 'auto';
const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');
const LOCAL_ASSET_RE = /^\/api\/assets\/(marketing|[0-9a-f-]{36})\/([a-z0-9][a-z0-9._-]{0,180})(?:\?.*)?$/i;

type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
};

function clean(value: string | undefined) {
  return value?.trim() ?? '';
}

function getConfig(): R2Config | null {
  const endpoint = clean(process.env.R2_ENDPOINT).replace(/\/+$/, '');
  const bucket = clean(process.env.R2_BUCKET);
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  const prefix = clean(process.env.R2_PREFIX || DEFAULT_PREFIX).replace(/^\/+|\/+$/g, '');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, prefix };
}

export function isR2Configured() {
  return Boolean(getConfig());
}

export function r2ConfigurationState() {
  return {
    configured: isR2Configured(),
    endpoint: Boolean(clean(process.env.R2_ENDPOINT)),
    bucket: Boolean(clean(process.env.R2_BUCKET)),
    accessKeyId: Boolean(clean(process.env.R2_ACCESS_KEY_ID)),
    secretAccessKey: Boolean(clean(process.env.R2_SECRET_ACCESS_KEY)),
  };
}

function hexSha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function amzTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function objectKey(jobId: string, filename: string, config: R2Config) {
  const base = `${jobId}/${filename}`;
  return config.prefix ? `${config.prefix}/${base}` : base;
}

function objectUrl(jobId: string, filename: string, config: R2Config) {
  const key = objectKey(jobId, filename, config)
    .split('/')
    .map(encodePathSegment)
    .join('/');
  return `${config.endpoint}/${encodePathSegment(config.bucket)}/${key}`;
}

function signedHeaders(method: string, url: URL, payloadHash: string, config: R2Config) {
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaderNames = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hexSha256(canonicalRequest)}`;
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
}

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.json') return 'application/json';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function hashFile(filePath: string) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function signedFetch(
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE',
  jobId: string,
  filename: string,
  options: { payloadHash?: string; headers?: Record<string, string>; body?: BodyInit | NodeJS.ReadableStream } = {},
) {
  const config = getConfig();
  if (!config) return null;
  const url = new URL(objectUrl(jobId, filename, config));
  const payloadHash = options.payloadHash ?? (method === 'PUT' ? EMPTY_SHA256 : 'UNSIGNED-PAYLOAD');
  const authHeaders = signedHeaders(method, url, payloadHash, config);
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: { ...options.headers, ...authHeaders },
  };
  if (options.body) {
    init.body = options.body as BodyInit;
    init.duplex = 'half';
  }
  return fetch(url, init);
}

function assertSuccessful(response: Response, operation: string) {
  if (response.ok) return;
  throw new Error(`Cloudflare R2 ${operation} failed (${response.status} ${response.statusText}).`);
}

export async function uploadBufferToR2(jobId: string, filename: string, data: Buffer) {
  if (!isR2Configured()) return false;
  const response = await signedFetch('PUT', jobId, filename, {
    payloadHash: hexSha256(data),
    headers: {
      'content-type': contentTypeFor(filename),
      'content-length': String(data.length),
    },
    body: data as unknown as BodyInit,
  });
  if (!response) return false;
  assertSuccessful(response, 'upload');
  return true;
}

export async function uploadFileToR2(jobId: string, filename: string, filePath: string) {
  if (!isR2Configured()) return false;
  const [stat, payloadHash] = await Promise.all([fs.stat(filePath), hashFile(filePath)]);
  const response = await signedFetch('PUT', jobId, filename, {
    payloadHash,
    headers: {
      'content-type': contentTypeFor(filename),
      'content-length': String(stat.size),
    },
    body: createReadStream(filePath),
  });
  if (!response) return false;
  assertSuccessful(response, 'upload');
  return true;
}

export async function persistAssetUrlToR2(storageUrl: string) {
  if (!isR2Configured()) return false;
  const match = storageUrl.match(LOCAL_ASSET_RE);
  if (!match) return false;
  const [, jobId, filename] = match;
  const filePath = path.join(LOCAL_ASSETS_DIR, jobId, filename);
  await uploadFileToR2(jobId, filename, filePath);
  return true;
}


export async function r2ObjectExists(jobId: string, filename: string) {
  if (!isR2Configured()) return false;
  const response = await signedFetch('HEAD', jobId, filename);
  if (!response) return false;
  if (response.status === 404) return false;
  assertSuccessful(response, 'head');
  return true;
}

export async function getR2Object(jobId: string, filename: string, range?: string | null) {
  if (!isR2Configured()) return null;
  return signedFetch('GET', jobId, filename, {
    headers: range ? { range } : undefined,
  });
}

export async function deleteR2Object(jobId: string, filename: string) {
  if (!isR2Configured()) return false;
  const response = await signedFetch('DELETE', jobId, filename);
  if (!response) return false;
  if (response.status === 404) return true;
  assertSuccessful(response, 'delete');
  return true;
}

/** Restore an R2 object into the local processing cache when a later render needs it. */
export async function ensureLocalAsset(jobId: string, filename: string) {
  const localPath = path.join(LOCAL_ASSETS_DIR, jobId, filename);
  try {
    const stat = await fs.stat(localPath);
    if (stat.isFile() && stat.size > 0) return localPath;
  } catch {
    // Cache miss: retrieve it from durable R2 storage below.
  }
  const response = await getR2Object(jobId, filename);
  if (!response || response.status === 404 || !response.ok || !response.body) return null;
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  const temporary = `${localPath}.r2-${process.pid}-${Date.now()}.tmp`;
  try {
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(temporary, { flags: 'wx' }));
    await fs.rename(temporary, localPath);
    return localPath;
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

