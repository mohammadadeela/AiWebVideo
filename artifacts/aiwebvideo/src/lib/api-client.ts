import { getIdToken } from '@/lib/firebase/client';
import type { JobStatusResponse, JobMode, JobWorkflowState } from '@/components/chat/types';

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
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong uploading your photos.', res.status, data.code);
  }
  return data as { jobId: string; status: string };
}

export async function uploadPrivatePages(jobId: string, files: File[]) {
  const token = await getIdToken();
  const form = new FormData();
  for (const file of files) form.append('images', file);
  const res = await fetch(`/api/uploads/${jobId}/add`, {
    method: 'POST', signal: AbortSignal.timeout(90_000),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Private-page screenshots could not be added.', res.status, data.code);
  return data as { jobId: string; added: number };
}

export function startCapture(url: string) {
  return request<{ jobId: string; status: string }>('/api/capture', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function requestStoryboard(
  jobId: string,
  mode: JobMode,
  vibeBrief: string,
  durationSeconds = 8,
  featuresText?: string,
  options?: { creativeBrief?: string; aspectRatio?: '16:9' | '9:16' | '1:1'; outputQuality?: '1080p' | '4k'; frameRate?: 30 | 60; selectedCaptureIds?: string[] }
) {
  return request<{ jobId: string; status: string }>(`/api/jobs/${jobId}/storyboard`, {
    method: 'POST',
    body: JSON.stringify({ mode, vibeBrief, durationSeconds, ...(featuresText ? { featuresText } : {}), ...options }),
  });
}

export function requestRender(jobId: string, audioMode: 'voice_music' | 'music_only' | 'silent' = 'voice_music', narrationLanguage = 'en') {
  return request<{ jobId: string; status: string; creditsSpent?: number; creditsRemaining?: number }>(
    `/api/jobs/${jobId}/render`,
    { method: 'POST', body: JSON.stringify({ audioMode, skipVoiceover: audioMode !== 'voice_music', narrationLanguage }) }
  );
}

export interface RenderCreditQuote {
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

export function requestRenderQuote(jobId: string, audioMode: 'voice_music' | 'music_only' | 'silent' = 'voice_music') {
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
  return request<{ id: string; email: string; plan: string; creditsBalance: number; isAdmin: boolean; accountStatus: string }>('/api/user/me');
}

export type ProviderChoice = 'auto' | 'gemini' | 'open_source';
export interface AdminSettings {
  providers: { image: ProviderChoice; video: ProviderChoice; fallbackEnabled: boolean };
  operations: { maintenanceMode: boolean; registrationsEnabled: boolean; maxConcurrentJobs: number };
}
export function fetchAdminOverview() { return request<Record<string, unknown> & AdminSettings>('/api/admin/overview'); }
export function fetchAdminUsers(search = '', page = 1) { return request<{ users: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}`); }
export function updateAdminUser(id: string, patch: { plan?: string; creditsBalance?: number; accountStatus?: string; isAdmin?: boolean }) { return request<{ user: Record<string, unknown> }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); }
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
export function fetchMarketingSettings() { return request<MarketingSettings>('/api/marketing'); }
export function saveMarketingSettings(settings: MarketingSettings) { return request<MarketingSettings>('/api/admin/marketing', { method: 'PUT', body: JSON.stringify(settings) }); }
export async function uploadMarketingAsset(file: File) {
  const token = await getIdToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/marketing/upload', { method: 'POST', signal: AbortSignal.timeout(120_000), headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
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

export type CheckoutId = 'creator' | 'pro' | 'agency' | 'single8' | 'single30' | 'single60' | 'topup100';
export type PaymentProvider = 'stripe' | 'paypal';

export function startCheckout(plan: CheckoutId, provider: PaymentProvider = 'stripe', jobId?: string | null) {
  return request<{ checkoutUrl: string }>(`/api/${provider}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ plan, ...(jobId ? { jobId } : {}) }),
  });
}

export function startTopup(provider: PaymentProvider = 'stripe') {
  return request<{ checkoutUrl: string }>(`/api/${provider}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ plan: 'topup100' }),
  });
}

export function openBillingPortal() {
  return request<{ portalUrl: string }>('/api/stripe/portal', { method: 'POST' });
}

export function cancelPaypalSubscription(subscriptionId: string) {
  return request<{ ok: boolean }>(`/api/paypal/subscriptions/${subscriptionId}/cancel`, { method: 'POST' });
}

// Local auth (no-Firebase fallback)
export async function localLogin(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Login failed.', res.status, data.code);
  if (data.token) {
    localStorage.setItem('aiwebvideo_token', data.token);
    window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
  }
  return data as { token: string; user: { email: string; plan: string; creditsBalance: number } };
}

// Email/password sign-up with a 6-digit email verification code.
// Step 1: send the code. No account exists until step 2 succeeds.
export async function requestSignupCode(email: string, password: string) {
  const res = await fetch('/api/auth/register/request-code', {
    method: 'POST',
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'That code did not work.', res.status, data.code);
  if (data.token) {
    localStorage.setItem('aiwebvideo_token', data.token);
    window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
  }
  return data as { token: string; user: { email: string; plan: string; creditsBalance: number } };
}

export async function resendSignupCode(email: string) {
  const res = await fetch('/api/auth/register/resend-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'We could not resend that code.', res.status, data.code);
  return data as { sent: true; expiresInSeconds: number };
}

// Attaches a chat started before sign-in to the now-authenticated account.
// Safe to call even if there is nothing to claim — the server no-ops.
export async function claimJob(jobId: string) {
  return request<{ claimed: boolean }>(`/api/jobs/${jobId}/claim`, { method: 'POST', body: '{}' });
}

export async function localRegister(email: string, password: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Registration failed.', res.status, data.code);
  if (data.token) {
    localStorage.setItem('aiwebvideo_token', data.token);
    window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
  }
  return data as { token: string; user: { email: string; plan: string; creditsBalance: number } };
}

export async function exchangeFirebaseToken(idToken: string) {
  const res = await fetch('/api/auth/firebase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Provider sign-in failed.', res.status, data.code);
  if (data.token) {
    localStorage.setItem('aiwebvideo_token', data.token);
    window.dispatchEvent(new Event('aiwebvideo-auth-changed'));
  }
  return data as { token: string; user: { email: string; plan: string; creditsBalance: number } };
}
