import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ASSETS_DIR, saveImageFile } from './capture.js';
import { query } from './pool.js';
import { recordGenerationCost } from './costs.js';

const execFileAsync = promisify(execFile);

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
  const model = response.model || (kind === 'image' ? 'flux2-klein-4b' : 'wan2.2-ti2v-5b');
  await query(`UPDATE jobs SET gpu_seconds=COALESCE(gpu_seconds,0)+$1,updated_at=NOW() WHERE id=$2`, [seconds, jobId]).catch(() => {});
  await recordGenerationCost({
    jobId, provider: 'self-hosted', model, operation: `${kind}_generation`,
    quantity: seconds, unit: 'gpu_second', unitCostUsd: Math.max(0, rate),
  });
}

type CancelCheck = () => Promise<boolean>;

function requestTimeoutMs(kind: Kind) {
  const specific = kind === 'video' ? process.env.GPU_VIDEO_REQUEST_TIMEOUT_MS : process.env.GPU_IMAGE_REQUEST_TIMEOUT_MS;
  const fallback = process.env.GPU_REQUEST_TIMEOUT_MS;
  const defaultMs = kind === 'video' ? 12 * 60_000 : 5 * 60_000;
  return Math.max(30_000, Number(specific ?? fallback ?? defaultMs));
}

async function request(kind: Kind, jobId: string, body: Record<string, unknown>, shouldCancel?: CancelCheck) {
  const runpod = runpodEndpoint(kind);
  if (runpod) return requestRunpod(runpod, kind, jobId, body, shouldCancel);
  const url = endpoint(kind);
  if (!url) throw new Error(`Self-hosted ${kind} endpoint is not configured.`);
  const controller = new AbortController();
  let cancelled = false;
  const timeoutMs = requestTimeoutMs(kind);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const cancelWatch = shouldCancel ? setInterval(() => {
    void shouldCancel().then((value) => {
      if (!value || cancelled) return;
      cancelled = true;
      controller.abort();
    }).catch(() => {});
  }, 1500) : null;
  const started = Date.now();
  console.info(`[gpu-${kind}] job=${jobId} direct_request_started timeout_s=${Math.round(timeoutMs / 1000)}`);
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
    console.info(`[gpu-${kind}] job=${jobId} direct_request_completed elapsed=${Math.round((Date.now() - started) / 1000)}s`);
    return result;
  } catch (error) {
    if (cancelled) throw new Error(`Open-source ${kind} generation was cancelled by the user.`);
    if ((error as Error).name === 'AbortError') throw new Error(`Open-source ${kind} generation timed out after ${Math.round(timeoutMs / 1000)}s.`);
    throw error;
  } finally {
    clearTimeout(timeout);
    if (cancelWatch) clearInterval(cancelWatch);
  }
}

async function requestRunpod(baseUrl: string, kind: Kind, jobId: string, body: Record<string, unknown>, shouldCancel?: CancelCheck) {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error('RUNPOD_API_KEY is not configured.');
  const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
  const started = Date.now();
  const submitted = await fetch(`${baseUrl}/run`, { method: 'POST', headers, body: JSON.stringify({ input: body }) });
  if (!submitted.ok) throw new Error(`RunPod submission returned ${submitted.status}.`);
  const submission = await submitted.json() as { id?: string };
  if (!submission.id) throw new Error('RunPod returned no job ID.');
  const timeoutMs = requestTimeoutMs(kind);
  const timeoutAt = Date.now() + timeoutMs;
  let lastLogAt = 0;
  console.info(`[gpu-${kind}] job=${jobId} runpod_submitted id=${submission.id} timeout_s=${Math.round(timeoutMs / 1000)}`);
  while (Date.now() < timeoutAt) {
    if (shouldCancel && await shouldCancel()) {
      throw new Error(`Open-source ${kind} generation was cancelled by the user.`);
    }
    const now = Date.now();
    if (now - lastLogAt >= 30_000) {
      lastLogAt = now;
      console.info(`[gpu-${kind}] job=${jobId} runpod_waiting id=${submission.id} elapsed=${Math.round((now - started) / 1000)}s`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`${baseUrl}/status/${submission.id}`, { headers });
    if (!statusResponse.ok) throw new Error(`RunPod status returned ${statusResponse.status}.`);
    const status = await statusResponse.json() as { status?: string; output?: GpuResponse; error?: string; executionTime?: number };
    if (status.status === 'COMPLETED' && status.output) {
      const result = { ...status.output, gpuSeconds: status.output.gpuSeconds ?? (status.executionTime ? status.executionTime / 1000 : undefined) };
      if (!result.data && !result.url) throw new Error('RunPod worker returned no generated file.');
      await record(jobId, kind, result, (Date.now() - started) / 1000);
      console.info(`[gpu-${kind}] job=${jobId} runpod_completed id=${submission.id} elapsed=${Math.round((Date.now() - started) / 1000)}s`);
      return result;
    }
    if (status.status === 'FAILED' || status.status === 'CANCELLED' || status.status === 'TIMED_OUT') {
      throw new Error(status.error || `RunPod job ${status.status.toLowerCase()}.`);
    }
  }
  throw new Error(`RunPod ${kind} generation timed out after ${Math.round(timeoutMs / 1000)}s.`);
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

export async function generateGpuVideo(jobId: string, sceneIndex: number, prompt: string, references: Buffer[], aspectRatio: string, shouldCancel?: CancelCheck) {
  // The self-hosted worker runs wan2.2-ti2v-5b by default — a small (5B
  // parameter) open video model. Two concrete, evidence-based improvements
  // over the previous request (which sent nothing but prompt/aspectRatio):
  //   1. negativePrompt: WAN2.2 explicitly supports negative prompting for
  //      cleanup of exactly the artifacts this model is prone to (blur,
  //      flicker, warped detail, extra/distorted limbs). Added as a best-
  //      effort optional field — if the deployed worker doesn't recognize
  //      it, it's simply extra JSON the worker ignores; nothing breaks.
  //   2. The prompt itself already carries full cinematic detail from the
  //      shared master prompt (verified against current WAN2.2 prompting
  //      guides: it wants a structured 80-120 word prompt, not a shortened
  //      one — under-specifying makes it default to "random cinematic"
  //      choices) so no simplification is applied, only the negative
  //      addition above.
  const negativePrompt = 'blurry, soft focus, flickering, unstable motion, warped text, garbled text, distorted logo, extra limbs, deformed hands, low detail, low quality, artifacts, watermark';
  const result = await request('video', jobId, {
    model: process.env.GPU_VIDEO_MODEL ?? 'wan2.2-ti2v-5b', prompt, negativePrompt, aspectRatio,
    durationSeconds: 8, references: encodedReferences(references, 3),
  }, shouldCancel);
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const raw = path.join(dir, `gpu-${sceneIndex}-raw.mp4`);
  await fs.writeFile(raw, await bytes(result));
  const output = path.join(dir, `gpu-${sceneIndex}.mp4`);
  await sharpenGpuClip(raw, output);
  return output;
}

/**
 * Small (5B-parameter) open video models like wan2.2-ti2v-5b commonly render
 * noticeably softer/blurrier detail than larger commercial models (Veo) —
 * this is a known, documented characteristic, not a bug in this app's
 * request. A mild unsharp mask meaningfully improves perceived sharpness
 * without introducing halo artifacts or otherwise altering content, and is
 * applied only to GPU-sourced clips — Gemini/Veo output already has enough
 * inherent detail that this would only look artificial there.
 */
export async function sharpenGpuClip(input: string, output: string): Promise<void> {
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', input,
      '-vf', 'unsharp=5:5:0.6:5:5:0.0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      output,
    ], { timeout: 5 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    // If sharpening fails for any reason (unexpected codec, corrupt input),
    // fall back to the original clip untouched rather than losing the scene.
    console.warn(`[gpu-video] sharpening failed, using original clip: ${(error as Error).message}`);
    await fs.copyFile(input, output);
  }
}
