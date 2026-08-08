import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ASSETS_DIR, saveImageFile } from './capture.js';
import { query } from './pool.js';

type Kind = 'image' | 'video';

interface GpuResponse {
  data?: string;
  url?: string;
  gpuSeconds?: number;
  model?: string;
}

function endpoint(kind: Kind) {
  const direct = kind === 'image' ? process.env.GPU_IMAGE_ENDPOINT : process.env.GPU_VIDEO_ENDPOINT;
  const base = process.env.GPU_SERVER_URL?.replace(/\/$/, '');
  return direct || (base ? `${base}/v1/generate/${kind}` : null);
}

function runpodEndpoint(kind: Kind) {
  const id = kind === 'image' ? process.env.RUNPOD_IMAGE_ENDPOINT_ID : process.env.RUNPOD_VIDEO_ENDPOINT_ID;
  return id ? `https://api.runpod.ai/v2/${id}` : null;
}

export function selfHostedEnabled(kind: Kind) {
  return Boolean(endpoint(kind) || runpodEndpoint(kind));
}

async function record(jobId: string, kind: Kind, response: GpuResponse, elapsedSeconds: number) {
  const seconds = Number.isFinite(response.gpuSeconds) ? Math.max(0, Number(response.gpuSeconds)) : elapsedSeconds;
  const rate = Number(process.env.GPU_COST_PER_SECOND_USD ?? 0);
  await query(
    `UPDATE jobs SET generation_provider=$1, gpu_seconds=COALESCE(gpu_seconds,0)+$2,
       generation_cost_usd=COALESCE(generation_cost_usd,0)+$3, updated_at=NOW() WHERE id=$4`,
    [`self-hosted:${response.model || (kind === 'image' ? 'flux2-klein-4b' : 'wan2.2-ti2v-5b')}`, seconds, seconds * Math.max(0, rate), jobId]
  ).catch(() => {});
}

async function request(kind: Kind, jobId: string, body: Record<string, unknown>) {
  const runpod = runpodEndpoint(kind);
  if (runpod) return requestRunpod(runpod, kind, jobId, body);
  const url = endpoint(kind);
  if (!url) throw new Error(`Self-hosted ${kind} endpoint is not configured.`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.GPU_REQUEST_TIMEOUT_MS ?? 1_800_000));
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(process.env.GPU_SERVER_SECRET ? { authorization: `Bearer ${process.env.GPU_SERVER_SECRET}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`GPU worker returned ${response.status}.`);
    const result = await response.json() as GpuResponse;
    if (!result.data && !result.url) throw new Error('GPU worker returned no generated file.');
    await record(jobId, kind, result, (Date.now() - started) / 1000);
    return result;
  } finally { clearTimeout(timeout); }
}

async function requestRunpod(baseUrl: string, kind: Kind, jobId: string, body: Record<string, unknown>) {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error('RUNPOD_API_KEY is not configured.');
  const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
  const started = Date.now();
  const submitted = await fetch(`${baseUrl}/run`, { method: 'POST', headers, body: JSON.stringify({ input: body }) });
  if (!submitted.ok) throw new Error(`RunPod submission returned ${submitted.status}.`);
  const submission = await submitted.json() as { id?: string };
  if (!submission.id) throw new Error('RunPod returned no job ID.');
  const timeoutAt = Date.now() + Number(process.env.GPU_REQUEST_TIMEOUT_MS ?? 1_800_000);
  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`${baseUrl}/status/${submission.id}`, { headers });
    if (!statusResponse.ok) throw new Error(`RunPod status returned ${statusResponse.status}.`);
    const status = await statusResponse.json() as { status?: string; output?: GpuResponse; error?: string; executionTime?: number };
    if (status.status === 'COMPLETED' && status.output) {
      const result = { ...status.output, gpuSeconds: status.output.gpuSeconds ?? (status.executionTime ? status.executionTime / 1000 : undefined) };
      if (!result.data && !result.url) throw new Error('RunPod worker returned no generated file.');
      await record(jobId, kind, result, (Date.now() - started) / 1000);
      return result;
    }
    if (status.status === 'FAILED' || status.status === 'CANCELLED' || status.status === 'TIMED_OUT') {
      throw new Error(status.error || `RunPod job ${status.status.toLowerCase()}.`);
    }
  }
  throw new Error('RunPod generation timed out.');
}

function encodedReferences(references: Buffer[], limit: number) {
  const selected: string[] = [];
  let bytes = 0;
  for (const image of references.slice(0, limit)) {
    if (bytes + image.length > 7 * 1024 * 1024) continue;
    selected.push(image.toString('base64'));
    bytes += image.length;
  }
  return selected;
}

async function bytes(result: GpuResponse) {
  if (result.data) return Buffer.from(result.data, 'base64');
  const response = await fetch(result.url!);
  if (!response.ok) throw new Error('Could not download the generated GPU file.');
  return Buffer.from(await response.arrayBuffer());
}

export async function generateGpuImage(jobId: string, sceneIndex: number, prompt: string, references: Buffer[], aspectRatio: string, quality: string) {
  const result = await request('image', jobId, {
    model: process.env.GPU_IMAGE_MODEL ?? 'flux2-klein-4b', prompt, aspectRatio, quality,
    references: encodedReferences(references, 4),
  });
  return saveImageFile(jobId, `photo-${sceneIndex}-${quality}.png`, await bytes(result));
}

export async function generateGpuVideo(jobId: string, sceneIndex: number, prompt: string, references: Buffer[], aspectRatio: string) {
  const result = await request('video', jobId, {
    model: process.env.GPU_VIDEO_MODEL ?? 'wan2.2-ti2v-5b', prompt, aspectRatio,
    durationSeconds: 8, references: encodedReferences(references, 3),
  });
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const output = path.join(dir, `gpu-${sceneIndex}.mp4`);
  await fs.writeFile(output, await bytes(result));
  return output;
}
