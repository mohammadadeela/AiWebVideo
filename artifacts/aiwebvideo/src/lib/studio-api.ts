import { getIdToken } from '@/lib/firebase/client';
import { ApiError, request } from '@/lib/api-client';

export type StudioAspectRatio = '16:9' | '9:16' | '1:1';
export type StudioLayerType = 'video' | 'image' | 'audio' | 'text' | 'shape';

export interface StudioLayer {
  id: string;
  type: StudioLayerType;
  name: string;
  assetId?: string | null;
  start: number;
  end: number;
  trimStart: number;
  trimEnd?: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  volume: number;
  speed: number;
  text?: string | null;
  style: Record<string, unknown>;
  effects: string[];
  transitionIn?: string | null;
  transitionOut?: string | null;
}

export interface StudioProjectState {
  schemaVersion: 1;
  canvas: { width: number; height: number; aspectRatio: StudioAspectRatio; background: string };
  duration: number;
  layers: StudioLayer[];
  selectedLayerId: string | null;
  captions: Array<{ id: string; start: number; end: number; text: string; style: Record<string, unknown> }>;
  metadata: Record<string, unknown>;
}

export interface StudioAsset {
  id: string;
  project_id: string;
  user_id: string;
  source_job_id: string | null;
  kind: 'video' | 'image' | 'audio' | 'logo' | 'generated' | 'screenshot';
  name: string;
  mime_type: string;
  storage_url: string;
  source_url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | string | null;
  size_bytes: number | string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface StudioProject {
  id: string;
  title: string;
  kind: 'video' | 'image';
  width: number;
  height: number;
  aspectRatio: StudioAspectRatio;
  durationSeconds: number;
  projectState: StudioProjectState;
  revision: number;
  sourceJobId: string | null;
  createdAt: string;
  updatedAt: string;
  assets: StudioAsset[];
}

export interface StudioEditCommand {
  type: string;
  label?: string;
  [key: string]: unknown;
}

export interface StudioEditPlan {
  execution: 'local' | 'paid';
  summary: string;
  commands: StudioEditCommand[];
  paidOperation?: string;
  costCredits: number;
  requiresConfirmation: boolean;
  context: { lastLayerId?: string | null };
}

export function listStudioProjects() {
  return request<{ projects: Array<Omit<StudioProject,'assets'>> }>('/api/studio/projects');
}

export function createStudioProject(input: { title?: string; kind: 'video' | 'image'; aspectRatio?: StudioAspectRatio }) {
  return request<StudioProject>('/api/studio/projects', { method: 'POST', body: JSON.stringify(input) });
}

export function importStudioJob(jobId: string) {
  return request<StudioProject>(`/api/studio/projects/import-job/${encodeURIComponent(jobId)}`, { method: 'POST', body: '{}' });
}

export function fetchStudioProject(projectId: string) {
  return request<StudioProject>(`/api/studio/projects/${encodeURIComponent(projectId)}`);
}

export function saveStudioProject(projectId: string, input: { revision: number; title?: string; projectState?: StudioProjectState; label?: string }) {
  return request<StudioProject>(`/api/studio/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteStudioProject(projectId: string) {
  return request<void>(`/api/studio/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}

export async function uploadStudioAssets(projectId: string, files: File[]) {
  const token = await getIdToken();
  const form = new FormData();
  for (const file of files) form.append('media', file);
  const response = await fetch(`/api/studio/projects/${encodeURIComponent(projectId)}/media`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || 'Could not upload Studio media.', response.status, data.code);
  return data as { assets: StudioAsset[] };
}

export function studioHistory(projectId: string, direction: 'undo' | 'redo') {
  return request<{ projectState: StudioProjectState; revision: number; historyCursor: number }>(`/api/studio/projects/${encodeURIComponent(projectId)}/history`, { method: 'POST', body: JSON.stringify({ direction }) });
}

export function planStudioEdit(projectId: string, instruction: string, attachmentIds: string[]) {
  return request<StudioEditPlan>(`/api/studio/projects/${encodeURIComponent(projectId)}/ai/plan`, { method: 'POST', body: JSON.stringify({ instruction, attachmentIds }) });
}

export function applyStudioEdit(projectId: string, instruction: string, attachmentIds: string[], idempotencyKey: string) {
  return request<{ operationId: string; status: string; requiredCredits?: number; project?: StudioProject; plan?: StudioEditPlan }>(`/api/studio/projects/${encodeURIComponent(projectId)}/ai/apply`, { method: 'POST', body: JSON.stringify({ instruction, attachmentIds, idempotencyKey }) });
}

export function fetchStudioOperation(operationId: string) {
  return request<{ id: string; projectId: string; operationType: string; executionKind: string; status: string; reservedCredits: number; finalCredits: number; actualCostUsd: number; error: string | null; outputAsset: StudioAsset | null; updatedAt: string }>(`/api/studio/operations/${encodeURIComponent(operationId)}`);
}

export function cancelStudioOperation(operationId: string) {
  return request<{ operationId: string; cancellationRequested: boolean; warning: string }>(`/api/studio/operations/${encodeURIComponent(operationId)}/cancel`, { method: 'POST', body: '{}' });
}

export function createStudioExport(projectId: string, resolution: '720p' | '1080p' | '4k', format?: 'mp4' | 'png' | 'jpg') {
  return request<{ exportId: string; status: string }>(`/api/studio/projects/${encodeURIComponent(projectId)}/exports`, { method: 'POST', body: JSON.stringify({ resolution, format }) });
}

export function fetchStudioExport(exportId: string) {
  return request<{ id: string; project_id: string; status: string; resolution: string; format: string; progress: number; storage_url: string | null; error: string | null; render_time_ms: number; created_at: string; updated_at: string }>(`/api/studio/exports/${encodeURIComponent(exportId)}`);
}

export function trackStudioEvent(input: { event: 'ideas_opened' | 'idea_clicked' | 'idea_to_generate_conversion' | 'idea_generation_success' | 'idea_generation_failure' | 'studio_opened' | 'studio_exported'; ideaId?: string; feature?: string; projectId?: string; metadata?: Record<string,string|number|boolean|null> }) {
  return request<void>('/api/studio/events', { method: 'POST', body: JSON.stringify(input) }).catch(() => undefined);
}

export function uid(prefix = 'layer') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function assetToLayer(asset: StudioAsset, project: StudioProjectState, start = 0): StudioLayer {
  const mediaDuration = Number(asset.duration_seconds ?? 0);
  const end = asset.mime_type.startsWith('audio/') || asset.mime_type.startsWith('video/')
    ? start + Math.max(0.5, mediaDuration || 8)
    : start + Math.max(0.5, project.duration || 5);
  return {
    id: uid(asset.kind),
    type: asset.mime_type.startsWith('video/') ? 'video' : asset.mime_type.startsWith('audio/') ? 'audio' : 'image',
    name: asset.name,
    assetId: asset.id,
    start,
    end,
    trimStart: 0,
    trimEnd: null,
    x: 0.5,
    y: 0.5,
    width: project.layers.some((layer) => layer.type === 'video' || layer.type === 'image') ? 0.32 : 1,
    height: project.layers.some((layer) => layer.type === 'video' || layer.type === 'image') ? 0.32 : 1,
    rotation: 0,
    opacity: 1,
    volume: 1,
    speed: 1,
    style: {},
    effects: [],
    transitionIn: null,
    transitionOut: null,
  };
}
