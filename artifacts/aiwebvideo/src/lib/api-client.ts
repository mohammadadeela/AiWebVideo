import { getIdToken } from '@/lib/firebase/client';
import type { AudioMode, JobStatusResponse, JobMode, JobWorkflowState } from '@/components/chat/types';

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
    throw new ApiError(data.error || 'Something went wrong.', res.status, data.code);
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
  studioKind: 'product' | 'idea' | 'scenario';
  mode: JobMode;
  durationSeconds: number;
  audioMode: AudioMode;
  aspectRatio: '16:9' | '9:16' | '1:1';
  outputQuality: '1080p' | '4k';
}) {
  const token = await getIdToken();
  const form = new FormData();
  for (const file of opts.files ?? []) form.append('images', file);
  if (opts.title) form.append('title', opts.title);
  if (opts.ideaPrompt) form.append('ideaPrompt', opts.ideaPrompt);
  form.append('studioKind', opts.studioKind);
  form.append('mode', opts.mode);
  form.append('durationSeconds', String(opts.durationSeconds));
  form.append('audioMode', opts.audioMode);
  form.append('aspectRatio', opts.aspectRatio);
  form.append('outputQuality', opts.outputQuality);
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
  options?: { creativeBrief?: string; aspectRatio?: '16:9' | '9:16' | '1:1'; outputQuality?: '1080p' | '4k'; audioMode?: AudioMode; frameRate?: 24 | 30 | 60; selectedCaptureIds?: string[] }
) {
  return request<{ jobId: string; status: string; creditsReserved?: number; creditsRemaining?: number }>(`/api/jobs/${jobId}/storyboard`, {
    method: 'POST',
    body: JSON.stringify({ mode, vibeBrief, durationSeconds, ...(featuresText ? { featuresText } : {}), ...options }),
  });
}

export function requestRender(jobId: string, audioMode: AudioMode = 'voice_music', narrationLanguage = 'en') {
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
) {
  return request<GenerationPreflightQuote>(`/api/jobs/${jobId}/preflight`, {
    method: 'POST',
    body: JSON.stringify({ mode, durationSeconds, outputQuality, audioMode }),
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

export function cancelJob(jobId: string) {
  return request<{ cancelling: boolean; immediate: boolean }>(`/api/jobs/${jobId}/cancel`, { method: 'POST', body: '{}' });
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
export interface AdminUserFilters { search?: string; page?: number; plan?: string; role?: 'all' | 'admin' | 'user'; status?: 'all' | 'active' | 'suspended'; auth?: 'all' | 'email' | 'google' | 'github' | 'facebook' | 'firebase' | 'unknown'; verified?: 'all' | 'verified' | 'unverified'; }
export function fetchAdminUsers(filters: AdminUserFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  if (filters.plan && filters.plan !== 'all') params.set('plan', filters.plan);
  if (filters.role && filters.role !== 'all') params.set('role', filters.role);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.auth && filters.auth !== 'all') params.set('auth', filters.auth);
  if (filters.verified && filters.verified !== 'all') params.set('verified', filters.verified);
  return request<{ users: Array<Record<string, unknown>>; total: number; page: number; pageSize: number; adminCount: number; summary: Record<string, unknown>; pendingSignups: Array<Record<string, unknown>> }>(`/api/admin/users?${params.toString()}`);
}
export function updateAdminUser(id: string, patch: { plan?: string; creditsBalance?: number; accountStatus?: string; isAdmin?: boolean }) { return request<{ user: Record<string, unknown> }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); }
export function fetchAdminUserDetails(id: string) { return request<{ user: Record<string, unknown>; subscriptions: Array<Record<string, unknown>>; payments: Array<Record<string, unknown>>; credits: Array<Record<string, unknown>>; productions: Array<Record<string, unknown>> }>(`/api/admin/users/${id}`); }
export function fetchAdminJobs(status = 'all', search = '') { return request<{ jobs: Array<Record<string, unknown>> }>(`/api/admin/jobs?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`); }
export function updateAdminJob(id: string, action: 'cancel' | 'hide') { return request(`/api/admin/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }); }
export function saveAdminSettings(settings: AdminSettings) { return request<AdminSettings>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); }
export function fetchAdminAudit() { return request<{ events: Array<Record<string, unknown>> }>('/api/admin/audit'); }

// ---- Read-only landing-page videos ----
export interface MarketingVideo { id: string; url: string | null; posterUrl: string | null; caption: string | null; overlayText: string | null; eyebrow: string | null; }
export interface MarketingSettings {
  heading: string;
  description: string;
  videos: { showcase: MarketingVideo[] };
}

// Public — powers the homepage, no auth required.
export function fetchMarketingSettings() { return request<MarketingSettings>('/api/marketing', { cache: 'default' }); }
export function saveMarketingSettings(settings: MarketingSettings) { return request<MarketingSettings>('/api/admin/marketing', { method: 'PUT', body: JSON.stringify(settings) }); }
export async function uploadMarketingAsset(file: File) {
  const token = await getIdToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/marketing/upload', { method: 'POST', signal: AbortSignal.timeout(120_000), credentials: 'same-origin', cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'The marketing asset could not be uploaded.', res.status, data.code);
  return data as { url: string; kind: 'video' | 'image' };
}

export interface UserJobSummary {
  id: string;
  title: string;
  sourceUrl: string;
  status: string;
  progress: number;
  mode: string;
  screenshotUrl: string | null;
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
