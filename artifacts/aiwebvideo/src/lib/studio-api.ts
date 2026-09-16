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

export interface StudioUploadProgress {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  fileProgress: number;
  overallProgress: number;
  uploadedBytes: number;
  totalBytes: number;
  phase: 'uploading' | 'processing';
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

async function parseApiResponse<T>(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  if (!response.ok) throw new ApiError(data.error || fallback, response.status, data.code);
  return data;
}

export async function uploadStudioAssets(
  projectId: string,
  files: File[],
  options: { onProgress?: (progress: StudioUploadProgress) => void; signal?: AbortSignal } = {},
) {
  const token = await getIdToken();
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
  let completedBytes = 0;
  const assets: StudioAsset[] = [];

  for (const [fileIndex, file] of files.entries()) {
    let uploadId: string | null = null;
    try {
      const initResponse = await fetch(`/api/studio/upload/projects/${encodeURIComponent(projectId)}/init`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: options.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }),
      });
      const init = await parseApiResponse<{ uploadId: string; chunkBytes: number; maxBytes: number; receivedBytes: number }>(initResponse, 'Could not start Studio upload.');
      uploadId = init.uploadId;
      let offset = Math.max(0, init.receivedBytes || 0);
      const chunkBytes = Math.max(1024 * 1024, init.chunkBytes || 8 * 1024 * 1024);

      while (offset < file.size) {
        if (options.signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError');
        const end = Math.min(file.size, offset + chunkBytes);
        const chunk = file.slice(offset, end);
        const chunkResponse = await fetch(
          `/api/studio/upload/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(init.uploadId)}/chunk?offset=${offset}`,
          {
            method: 'PUT',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: options.signal,
            headers: {
              'Content-Type': 'application/octet-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: chunk,
          },
        );
        const chunkResult = await parseApiResponse<{ receivedBytes: number; totalBytes: number }>(chunkResponse, 'Studio upload was interrupted.');
        offset = chunkResult.receivedBytes;
        const uploadedBytes = completedBytes + offset;
        options.onProgress?.({
          fileName: file.name,
          fileIndex,
          fileCount: files.length,
          fileProgress: Math.round((offset / Math.max(1, file.size)) * 100),
          overallProgress: Math.round((uploadedBytes / totalBytes) * 100),
          uploadedBytes,
          totalBytes,
          phase: 'uploading',
        });
      }

      options.onProgress?.({
        fileName: file.name,
        fileIndex,
        fileCount: files.length,
        fileProgress: 100,
        overallProgress: Math.round(((completedBytes + file.size) / totalBytes) * 100),
        uploadedBytes: completedBytes + file.size,
        totalBytes,
        phase: 'processing',
      });

      const completeResponse = await fetch(
        `/api/studio/upload/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(init.uploadId)}/complete`,
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: options.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const completed = await parseApiResponse<{ asset: StudioAsset }>(completeResponse, 'Could not finish Studio upload.');
      assets.push(completed.asset);
      completedBytes += file.size;
      uploadId = null;
    } catch (error) {
      if (uploadId) {
        void fetch(`/api/studio/upload/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(uploadId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }).catch(() => undefined);
      }
      throw error;
    }
  }

  return { assets };
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