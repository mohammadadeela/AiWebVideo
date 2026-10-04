import { getIdToken } from '@/lib/firebase/client';
import type { AudioMode, JobStatusResponse, JobMode, JobWorkflowState } from '@/components/chat/types';

export class ApiError extends Error {
  code?: string;
  status: number;
  /** The product's name as written in a link the shop would not let us read, so the page can keep it. */
  productName?: string;
  /** What a product link already gave us even though no photo was found: kept so nothing found is thrown away. */
  productDescription?: string;
  productFacts?: Record<string, string>;
  constructor(message: string, status: number, code?: string, details?: { productName?: string; productDescription?: string; productFacts?: Record<string, string> }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.productName = details?.productName;
    this.productDescription = details?.productDescription;
    this.productFacts = details?.productFacts;
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(20_000),
    credentials: init.credentials ?? 'same-origin',
    cache: init.cache ?? 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let productFacts: Record<string, string> | undefined;
    if (typeof data.productFacts === 'string') { try { productFacts = JSON.parse(data.productFacts) as Record<string, string>; } catch { /* facts are optional */ } }
    throw new ApiError(data.error || 'Something went wrong.', res.status, data.code, typeof data.productName === 'string' || productFacts
      ? { productName: typeof data.productName === 'string' ? data.productName : undefined, productDescription: typeof data.productDescription === 'string' ? data.productDescription : undefined, productFacts }
      : undefined);
  }
  return data as T;
}

/**
 * Uploads user-supplied photos directly (no website capture). Uses FormData,
 * not the JSON request() helper above — a manually-set 'Content-Type' would
 * strip the multipart boundary the browser needs to add itself.
 */
export async function uploadPhotos(files: File[], title?: string) {
  const token = await getIdToken();
  const form = new FormData();
  for (const file of files) form.append('images', file);
  if (title) form.append('title', title);
  const res = await fetch('/api/uploads', {
    method: 'POST',
    signal: AbortSignal.timeout(10 * 60_000),
    credentials: 'same-origin',
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong uploading your photos.', res.status, data.code);
  }
  return data as { jobId: string; status: string };
}

/**
 * Studio entry point for AI Product Photos & Video, Custom Idea Video, and
 * Scenario Video. This is explicitly marked as a Studio request so the server
 * can keep it separate from website capture, require an account, verify the
 * exact credit requirement, and allow text-only Custom Idea/Scenario jobs.
 */
export async function uploadStudioMedia(opts: {
  files?: File[];
  title?: string;
  ideaPrompt?: string;
  studioKind: 'product' | 'idea' | 'scenario' | 'interior' | 'architecture';
  mode: JobMode;
  durationSeconds: number;
  audioMode: AudioMode;
  aspectRatio: '16:9' | '9:16' | '1:1';
  outputQuality: '1080p' | '4k';
  modelId?: string;
  productUrl?: string;
  productImageUrls?: string[];
  architecture?: Record<string, string | number | boolean | undefined>;
  /** Hidden creative direction from an Idea chip; never shown to the customer. */
  studioDirection?: string;
  /** A showcase sample to recreate with the customer's own references. */
  templateId?: string;
  /** What the product page says (title, description, price...), to brief the AI accurately. */
  productFacts?: { title?: string; description?: string; facts?: Record<string, string> };
  /** An engineer's CAD drawing (.dxf) for Interior Design and Architecture, and the units the customer confirmed for it. */
  drawing?: File;
  drawingUnits?: string;
}) {
  const token = await getIdToken();
  const form = new FormData();
  for (const file of opts.files ?? []) form.append('images', file);
  if (opts.drawing) {
    form.append('drawing', opts.drawing);
    if (opts.drawingUnits) form.append('drawingUnits', opts.drawingUnits);
  }
  if (opts.title) form.append('title', opts.title);
  if (opts.ideaPrompt) form.append('ideaPrompt', opts.ideaPrompt);
  form.append('studioKind', opts.studioKind);
  form.append('mode', opts.mode);
  form.append('durationSeconds', String(opts.durationSeconds));
  form.append('audioMode', opts.audioMode);
  form.append('aspectRatio', opts.aspectRatio);
  form.append('outputQuality', opts.outputQuality);
  if (opts.modelId) form.append('modelId', opts.modelId);
  if (opts.productUrl) form.append('productUrl', opts.productUrl);
  if (opts.productImageUrls?.length) form.append('productImageUrls', JSON.stringify(opts.productImageUrls));
  if (opts.architecture) form.append('architecture', JSON.stringify(opts.architecture));
  if (opts.studioDirection) form.append('studioDirection', opts.studioDirection);
  if (opts.templateId) form.append('templateId', opts.templateId);
  if (opts.productFacts) form.append('productFacts', JSON.stringify(opts.productFacts));
  const res = await fetch('/api/uploads', {
    method: 'POST',
    signal: AbortSignal.timeout(10 * 60_000),
    credentials: 'same-origin',
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong starting your production.', res.status, data.code);
  }
  return data as { jobId: string; status: string };
}

export type DrawingUnitChoice = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** What the server read from a CAD drawing (see lib/cad-drawing.ts on the server). All sizes are in metres. */
export interface DrawingPreview {
  fileName: string;
  units: { choice: DrawingUnitChoice; name: string; source: 'file' | 'customer' | 'guessed'; needsConfirmation: boolean; note?: string };
  extents: { widthM: number; depthM: number; heightM: number | null } | null;
  outerBoundary: { widthM: number; depthM: number; areaM2: number; rectangular: boolean } | null;
  rooms: Array<{ label: string; areaM2: number; widthM: number; depthM: number; rectangular: boolean }>;
  roomCount: number;
  dimensionCount: number;
  dimensionCheck: { measured: number; compared: number; mismatched: number };
  layers: Array<{ name: string; entities: number }>;
  warnings: string[];
  /** A picture of the plan (an SVG image) to look at, or null when it would be too large. */
  previewSvg: string | null;
}

/** Reads a drawing on the server and returns what was found, before anything is generated or charged. */
export async function previewDrawing(file: File, units?: DrawingUnitChoice): Promise<DrawingPreview> {
  const form = new FormData();
  form.append('drawing', file);
  if (units) form.append('units', units);
  const res = await fetch('/api/uploads/drawing-preview', {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    credentials: 'same-origin',
    cache: 'no-store',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Your drawing could not be read.', res.status, data.code);
  return data as DrawingPreview;
}

export async function uploadPrivatePages(jobId: string, files: File[]) {
  const token = await getIdToken();
  const form = new FormData();
  for (const file of files) form.append('images', file);
  const res = await fetch(`/api/uploads/${jobId}/add`, {
    method: 'POST', signal: AbortSignal.timeout(90_000),
    credentials: 'same-origin', cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Private-page screenshots could not be added.', res.status, data.code);
  return data as { jobId: string; added: number };
}

export function startCapture(url: string, creativeBrief: string, setupSummary?: string) {
  return request<{ jobId: string; status: string }>('/api/capture', {
    method: 'POST',
    body: JSON.stringify({ url, creativeBrief, ...(setupSummary ? { setupSummary } : {}) }),
  });
}

export function requestStoryboard(
  jobId: string,
  mode: JobMode,
  vibeBrief: string,
  durationSeconds = 8,
  featuresText?: string,
  options?: { creativeBrief?: string; aspectRatio?: '16:9' | '9:16' | '1:1'; outputQuality?: '1080p' | '4k'; audioMode?: AudioMode; frameRate?: 24 | 30 | 60; selectedCaptureIds?: string[]; selectedGeneratedPhotoIds?: string[]; modelId?: string }
) {
  return request<{ jobId: string; status: string; creditsReserved?: number; creditsRemaining?: number }>(`/api/jobs/${jobId}/storyboard`, {
    method: 'POST',
    body: JSON.stringify({ mode, vibeBrief, durationSeconds, ...(featuresText ? { featuresText } : {}), ...options }),
  });
}

export function requestRender(jobId: string, audioMode: AudioMode = 'voice_music', narrationLanguage = 'auto') {
  return request<{ jobId: string; status: string; creditsSpent?: number; creditsRemaining?: number }>(
    `/api/jobs/${jobId}/render`,
    { method: 'POST', body: JSON.stringify({ audioMode, skipVoiceover: audioMode !== 'voice_music', narrationLanguage }) }
  );
}

export interface GenerationPreflightQuote {
  generatedSeconds: number;
  perSecondCredits: number;
  videoCredits: number;
  photoCredits: number;
  narrationCredits: number;
  totalCredits: number;
  balance: number;
  shortfall: number;
  affordable: boolean;
}

export function requestGenerationPreflight(
  jobId: string,
  mode: JobMode,
  durationSeconds: number,
  outputQuality: '1080p' | '4k',
  audioMode: AudioMode = 'native_audio',
  modelId?: string,
) {
  return request<GenerationPreflightQuote>(`/api/jobs/${jobId}/preflight`, {
    method: 'POST',
    body: JSON.stringify({ mode, durationSeconds, outputQuality, audioMode, ...(modelId ? { modelId } : {}) }),
  });
}

export interface RenderCreditQuote {
  generatedSeconds: number;
  perSecondCredits: number;
  videoCredits: number;
  photoCredits: number;
  narrationCredits: number;
  totalCredits: number;
  balance: number;
  reservedCredits?: number;
  additionalRequired?: number;
  shortfall: number;
  affordable: boolean;
}

export function requestRenderQuote(jobId: string, audioMode: AudioMode = 'voice_music') {
  return request<RenderCreditQuote>(`/api/jobs/${jobId}/quote`, { method: 'POST', body: JSON.stringify({ audioMode }) });
}

/**
 * Stop is destructive once paid AI production has started. Read the live job
 * first so the user sees the exact reserved-credit amount before confirming.
 * The backend remains authoritative; this warning is UX protection, not the
 * billing enforcement itself.
 */
export async function cancelJob(jobId: string) {
  let creditsAtRisk = 0;
  try {
    const current = await fetchJob(jobId);
    creditsAtRisk = Math.max(0, Math.round(current.creditsSpent ?? 0));
  } catch {
    // The cancellation endpoint still performs ownership/status validation.
    // If the preview read fails, show the conservative warning below.
  }

  if (typeof window !== 'undefined') {
    const warning = creditsAtRisk > 0
      ? `Stop this production?\n\nThis production has already reserved ${creditsAtRisk} credits. If you stop now, all ${creditsAtRisk} credits will be lost and will NOT be refunded.\n\nContinue stopping?`
      : 'Stop this process?\n\nNo paid generation credits are currently reserved. If paid AI generation starts before the stop is processed, those reserved credits are not refundable.\n\nContinue stopping?';
    if (!window.confirm(warning)) {
      throw new ApiError('Cancellation not confirmed. Your production is still running.', 409, 'CANCEL_NOT_CONFIRMED');
    }
  }

  const result = await request<{ cancelling: boolean; immediate: boolean }>(`/api/jobs/${jobId}/cancel`, {
    method: 'POST',
    body: '{}',
  });
  return { ...result, creditsLost: creditsAtRisk };
}

export function fetchJob(jobId: string) {
  return request<JobStatusResponse>(`/api/jobs/${jobId}`);
}

export function saveJobWorkflow(jobId: string, state: JobWorkflowState) {
  return request<{ saved: true; updatedAt: string }>(`/api/jobs/${jobId}/workflow`, {
    method: 'PATCH', body: JSON.stringify(state),
  });
}

export function fetchMe() {
  return request<{ id: string; email: string; plan: string; creditsBalance: number; isAdmin: boolean; accountStatus: string; authProvider: string; supportsPasswordChange: boolean }>('/api/user/me');
}

export interface AdminSettings {
  operations: { maintenanceMode: boolean; registrationsEnabled: boolean; maxConcurrentJobs: number };
}
export function fetchAdminOverview() { return request<Record<string, unknown> & AdminSettings>('/api/admin/overview'); }
export type AdminReportRange = 'today' | '7d' | '30d' | 'month' | 'year' | 'all';
export function fetchAdminReports(range: AdminReportRange = 'month') {
  return request<Record<string, unknown>>(`/api/admin/reports?range=${encodeURIComponent(range)}`);
}
export interface AdminUserFilters { search?: string; searchBy?: 'all' | 'email' | 'id' | 'payment' | 'subscription'; page?: number; plan?: string; role?: 'all' | 'admin' | 'user'; status?: 'all' | 'active' | 'suspended'; auth?: 'all' | 'email' | 'google' | 'github' | 'facebook' | 'firebase' | 'unknown'; verified?: 'all' | 'verified' | 'unverified'; billing?: 'all' | 'paying' | 'purchased' | 'subscribed' | 'active_subscription' | 'never_paid'; joined?: 'all' | 'today' | '7d' | '30d' | 'year'; sort?: 'newest' | 'oldest' | 'recent_signin' | 'highest_spend' | 'highest_credits' | 'most_productions'; }
export function fetchAdminUsers(filters: AdminUserFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.searchBy && filters.searchBy !== 'all') params.set('searchBy', filters.searchBy);
  params.set('page', String(filters.page ?? 1));
  if (filters.plan && filters.plan !== 'all') params.set('plan', filters.plan);
  if (filters.role && filters.role !== 'all') params.set('role', filters.role);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.auth && filters.auth !== 'all') params.set('auth', filters.auth);
  if (filters.verified && filters.verified !== 'all') params.set('verified', filters.verified);
  if (filters.billing && filters.billing !== 'all') params.set('billing', filters.billing);
  if (filters.joined && filters.joined !== 'all') params.set('joined', filters.joined);
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  return request<{ users: Array<Record<string, unknown>>; total: number; page: number; pageSize: number; adminCount: number; summary: Record<string, unknown>; pendingSignups: Array<Record<string, unknown>> }>(`/api/admin/users?${params.toString()}`);
}
export function updateAdminUser(id: string, patch: { plan?: string; creditsBalance?: number; accountStatus?: string; isAdmin?: boolean }) { return request<{ user: Record<string, unknown> }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); }
export function fetchAdminUserDetails(id: string) { return request<{ user: Record<string, unknown>; subscriptions: Array<Record<string, unknown>>; payments: Array<Record<string, unknown>>; credits: Array<Record<string, unknown>>; productions: Array<Record<string, unknown>> }>(`/api/admin/users/${id}`); }
export interface AdminJobFilters { search?: string; searchBy?: 'all' | 'title' | 'id' | 'url' | 'user' | 'provider' | 'error'; status?: string; feature?: string; provider?: 'all' | 'gemini' | 'other' | 'unassigned'; created?: 'all' | 'today' | '7d' | '30d' | 'year'; billing?: 'all' | 'charged' | 'no_charge'; quality?: 'all' | '1080p' | '4k'; sort?: 'newest' | 'oldest' | 'highest_cost' | 'highest_credits' | 'most_progress'; }
export function fetchAdminJobs(filters: AdminJobFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== 'all' && value !== 'newest') params.set(key, String(value));
  return request<{ jobs: Array<Record<string, unknown>> }>(`/api/admin/jobs?${params.toString()}`);
}
export function updateAdminJob(id: string, action: 'cancel' | 'hide') { return request(`/api/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }); }
export function saveAdminSettings(settings: AdminSettings) { return request<AdminSettings>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); }
export interface AdminAuditFilters { search?: string; searchBy?: 'all' | 'action' | 'admin' | 'target' | 'details'; category?: 'all' | 'user' | 'job' | 'settings' | 'marketing'; created?: 'all' | 'today' | '7d' | '30d' | 'year'; sort?: 'newest' | 'oldest'; }
export function fetchAdminAudit(filters: AdminAuditFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== 'all' && value !== 'newest') params.set(key, String(value));
  return request<{ events: Array<Record<string, unknown>> }>(`/api/admin/audit?${params.toString()}`);
}

// ---- Read-only landing-page videos ----
export const SHOWCASE_FEATURES = ['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture'] as const;
export type ShowcaseFeature = (typeof SHOWCASE_FEATURES)[number];
export const SHOWCASE_FEATURE_LABELS: Record<ShowcaseFeature, string> = {
  website: 'Website video',
  video: 'AI video',
  photo: 'Product photos',
  'product-video': 'Product video',
  scenario: 'Talking scene',
  interior: 'Interior design',
  architecture: 'Architecture',
};
export interface MarketingVideo {
  id: string;
  url: string | null;
  posterUrl: string | null;
  caption: string | null;
  overlayText: string | null;
  eyebrow: string | null;
  /** Older saved items have no kind and are videos. */
  kind?: 'image' | 'video';
  /** The chat feature this sample is filed under. */
  feature?: ShowcaseFeature | null;
}
export interface MarketingSettings {
  heading: string;
  description: string;
  videos: {
    /** The home page gallery. */
    showcase: MarketingVideo[];
    /** The few examples right under the chat box. Uploaded by an admin for that place; never taken from the gallery. */
    examples?: MarketingVideo[];
  };
}

// Public — powers the homepage, no auth required.
export function fetchMarketingSettings() { return request<MarketingSettings>('/api/marketing', { cache: 'default' }); }
export function saveMarketingSettings(settings: MarketingSettings) { return request<MarketingSettings>('/api/admin/marketing', { method: 'PUT', body: JSON.stringify(settings) }); }
/** Re-encodes one uploaded video for phones. Returns the same url when it was already fine. */
export function optimizeMarketingVideo(url: string) {
  return request<{ url: string; posterUrl: string | null; optimized: boolean; bytesBefore?: number; bytesAfter?: number }>(
    '/api/admin/marketing/optimize',
    { method: 'POST', body: JSON.stringify({ url }), signal: AbortSignal.timeout(12 * 60_000) },
  );
}
export async function uploadMarketingAsset(file: File) {
  const token = await getIdToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/marketing/upload', { method: 'POST', signal: AbortSignal.timeout(12 * 60_000), credentials: 'same-origin', cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'The marketing asset could not be uploaded.', res.status, data.code);
  return data as { url: string; kind: 'video' | 'image'; posterUrl?: string | null };
}

export function resolveArchitectureLocation(link: string) {
  return request<{ latitude?: number; longitude?: number; label: string | null; resolvedUrl: string; scale: 'unknown'; imageryAvailable: boolean; precision?: 'pin' | 'view' | 'none' }>('/api/architecture/location', {
    method: 'POST',
    body: JSON.stringify({ link }),
  });
}

/** What reading a product link returns: its name, what the page says about it, and its photos. */
export interface ProductReference {
  title: string;
  description: string;
  url: string;
  images: string[];
  facts?: Record<string, string>;
  source?: 'page' | 'shop-data' | 'rendered';
  /** How it was read (server vocabulary): SUCCESS_HTTP, SUCCESS_JSONLD, SUCCESS_PLAYWRIGHT, PARTIAL_SUCCESS, DIRECT_IMAGE. */
  status?: string;
}

/** Is there Street View at a spot, from which panorama, how old, and which way faces the plot? (The key stays on the server.) */
export interface StreetViewInfo {
  enabled: boolean;
  available: boolean;
  panoId?: string;
  date?: string | null;
  dateLabel?: string | null;
  ageYears?: number | null;
  distanceM?: number;
  headingToPlot?: number | null;
  /** Only sent to the site owner: what is missing on the server when Street View is off. */
  reason?: string;
}

export function getStreetView(latitude: number, longitude: number, signal?: AbortSignal) {
  return request<StreetViewInfo>(`/api/architecture/street-view?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`, { signal });
}

/** A free street photo near the plot (from Mapillary volunteers), best first. The picture links carry no token. */
export interface NearbyPhoto {
  id: string;
  thumbUrl: string;
  previewUrl: string;
  dateLabel: string | null;
  distanceM: number;
  facesPlot: boolean;
  heading: number | null;
  /** The photographer's name: the CC BY-SA license requires showing it. */
  credit: string | null;
}
export interface NearbyPhotosInfo { enabled: boolean; photos: NearbyPhoto[]; reason?: string }

export function getNearbyPhotos(latitude: number, longitude: number, signal?: AbortSignal) {
  return request<NearbyPhotosInfo>(`/api/architecture/photos?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`, { signal });
}

/** One Street View picture (4:3), served by our own server. The same frame the design is made from. */
export function streetViewImageSrc(panoId: string, view: { heading: number; pitch?: number; fov?: number }): string {
  const heading = Math.round(((view.heading % 360) + 360) % 360);
  return `/api/architecture/street-view/image?pano=${encodeURIComponent(panoId)}&heading=${heading}&pitch=${Math.round(view.pitch ?? 5)}&fov=${Math.round(view.fov ?? 90)}`;
}

export function extractProductReference(url: string) {
  return request<ProductReference>('/api/product-reference/extract', {
    method: 'POST',
    body: JSON.stringify({ url }),
    // The server may need its browser step for a script-heavy shop; the default 20 s would cut that off and show a failure.
    signal: AbortSignal.timeout(70_000),
  });
}

export interface UserJobSummary {
  id: string;
  title: string;
  sourceUrl: string;
  status: string;
  progress: number;
  mode: string;
  featureType: string;
  featureLabel: string;
  screenshotUrl: string | null;
  previewUrl: string | null;
  pinned: boolean;
  updatedAt: string;
  createdAt: string;
}

export function fetchUserJobs() {
  return request<{ jobs: UserJobSummary[] }>('/api/user/jobs');
}

export function updateSavedChat(jobId: string, patch: { title?: string; pinned?: boolean }) {
  return request<{ id: string; title: string | null; pinned: boolean; updatedAt: string }>(`/api/jobs/${jobId}`, {
    method: 'PATCH', body: JSON.stringify(patch),
  });
}

export function deleteSavedChat(jobId: string) {
  return request<{ deleted: true }>(`/api/jobs/${jobId}`, { method: 'DELETE' });
}

export function reuseSavedCapture(jobId: string) {
  return request<{ jobId: string; status: string }>(`/api/jobs/${jobId}/reuse`, { method: 'POST' });
}

export function saveJobMessage(
  jobId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  kind = 'text',
  payload?: Record<string, unknown>,
) {
  return request<{ id: string; createdAt: string }>(`/api/jobs/${jobId}/messages`, {
    method: 'POST', body: JSON.stringify({ role, content, kind, ...(payload ? { payload } : {}) }),
  });
}

export type CheckoutId = 'creator' | 'pro' | 'agency' | 'single8' | 'single48' | 'single144' | 'topup50' | 'topup100' | 'topup250';

export function startCheckout(plan: CheckoutId, jobId?: string | null) {
  return request<{ checkoutUrl: string }>('/api/paypal/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, ...(jobId ? { jobId } : {}) }),
  });
}

export function startTopup() {
  return startCheckout('topup100');
}

export interface SubscriptionSummary {
  id: string;
  plan: string;
  status: string;
  autoRenew: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  lastPaymentFailedAt: string | null;
}

export interface UserUsageSummary {
  period: { monthStart: string };
  balance: number;
  thisMonth: {
    creditsUsed: number;
    creditsAdded: number;
    projects: number;
    completed: number;
    videos: number;
    photos: number;
    amountPaidUsd: number;
  };
  allTime: {
    creditsUsed: number;
    creditsAdded: number;
    projects: number;
    completed: number;
    videos: number;
    photos: number;
    amountPaidUsd: number;
  };
  byMode: Array<{ mode: string; count: number }>;
  recentCredits: Array<{ id: string; delta: number; reason: string; createdAt: string }>;
}

export interface BillingPaymentSummary {
  id: string;
  reference: string;
  kind: string;
  amountUsd: number;
  currency: string;
  creditsGranted: number;
  plan: string | null;
  status: string;
  createdAt: string;
}

export function fetchSubscriptions() {
  return request<{ subscriptions: SubscriptionSummary[] }>('/api/paypal/subscriptions');
}

export function fetchUserUsage() {
  return request<UserUsageSummary>('/api/user/usage');
}

export function fetchBillingHistory() {
  return request<{ payments: BillingPaymentSummary[] }>('/api/paypal/billing-history');
}

export function cancelSubscription(subscriptionId: string) {
  return request<{ ok: boolean }>(`/api/paypal/subscriptions/${subscriptionId}/cancel`, { method: 'POST' });
}

// Local auth (no-Firebase fallback)
function finishBrowserSession(): void {
  // Remove legacy browser-readable JWTs after the server has issued an
  // HttpOnly cookie. This also wakes every mounted auth-state listener.
  localStorage.removeItem('aiwebvideo_token');
  window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
}

export async function localLogin(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Login failed.', res.status, data.code);
  finishBrowserSession();
  return data as { user: { email: string; plan: string; creditsBalance: number } };
}

// Email/password sign-up with a 6-digit email verification code.
// Step 1: send the code. No account exists until step 2 succeeds.
export async function requestSignupCode(email: string, password: string) {
  const res = await fetch('/api/auth/register/request-code', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'We could not send that code.', res.status, data.code);
  return data as { sent: true; expiresInSeconds: number };
}

// Step 2: confirm the code and create the account.
export async function verifySignupCode(email: string, code: string) {
  const res = await fetch('/api/auth/register/verify-code', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'That code did not work.', res.status, data.code);
  finishBrowserSession();
  return data as { user: { email: string; plan: string; creditsBalance: number } };
}

export async function resendSignupCode(email: string) {
  const res = await fetch('/api/auth/register/resend-code', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'We could not resend that code.', res.status, data.code);
  return data as { sent: true; expiresInSeconds: number };
}

export async function requestPasswordResetCode(email: string) {
  const res = await fetch('/api/auth/forgot-password/request-code', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'We could not send a password reset code.', res.status, data.code);
  return data as { sent: true; expiresInSeconds: number };
}

export async function resetPasswordWithCode(email: string, code: string, password: string) {
  const res = await fetch('/api/auth/forgot-password/reset', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'We could not reset your password.', res.status, data.code);
  finishBrowserSession();
  return data as { reset: true };
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const data = await request<{ changed: true }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  finishBrowserSession();
  return data;
}

// Attaches a chat started before sign-in to the now-authenticated account.
// Safe to call even if there is nothing to claim — the server no-ops.
export async function claimJob(jobId: string) {
  return request<{ claimed: boolean }>(`/api/jobs/${jobId}/claim`, { method: 'POST', body: '{}' });
}

export async function localRegister(email: string, password: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Registration failed.', res.status, data.code);
  finishBrowserSession();
  return data as { user: { email: string; plan: string; creditsBalance: number } };
}

export async function exchangeFirebaseToken(idToken: string) {
  const res = await fetch('/api/auth/firebase', {
    method: 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Provider sign-in failed.', res.status, data.code);
  finishBrowserSession();
  return data as { user: { email: string; plan: string; creditsBalance: number } };
}

/** Admin only: what the server makes of a product link or a map link, step by step. */
export interface LinkCheckResult {
  kind: 'product' | 'map';
  ok: boolean;
  ms: number;
  error?: string;
  code?: string | null;
  trace: string[];
  result?: Record<string, unknown> & { images?: string[]; latitude?: number; longitude?: number; precision?: string; label?: string | null; title?: string; source?: string; imagery?: string; resolvedUrl?: string };
}
export function checkAdminLink(kind: 'product' | 'map', link: string) {
  return request<LinkCheckResult>('/api/admin/link-check', { method: 'POST', body: JSON.stringify({ kind, link }), signal: AbortSignal.timeout(60_000) });
}
