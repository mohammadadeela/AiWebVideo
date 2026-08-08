import { getIdToken } from '@/lib/firebase/client';
import type { JobStatusResponse, JobMode } from '@/components/chat/types';

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
  options?: { creativeBrief?: string; aspectRatio?: '16:9' | '9:16' | '1:1'; outputQuality?: '1080p' | '4k'; frameRate?: 30 | 60 }
) {
  return request<{ jobId: string; status: string }>(`/api/jobs/${jobId}/storyboard`, {
    method: 'POST',
    body: JSON.stringify({ mode, vibeBrief, durationSeconds, ...(featuresText ? { featuresText } : {}), ...options }),
  });
}

export function requestRender(jobId: string, skipVoiceover?: boolean) {
  return request<{ jobId: string; status: string; creditsSpent?: number; creditsRemaining?: number }>(
    `/api/jobs/${jobId}/render`,
    { method: 'POST', body: JSON.stringify({ skipVoiceover: !!skipVoiceover }) }
  );
}

export function fetchJob(jobId: string) {
  return request<JobStatusResponse>(`/api/jobs/${jobId}`);
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

export type CheckoutId = 'creator' | 'pro' | 'agency' | 'single8' | 'single30' | 'single60';

export function startCheckout(plan: CheckoutId) {
  return request<{ checkoutUrl: string }>('/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export function startTopup() {
  return request<{ checkoutUrl: string }>('/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'topup100' }),
  });
}

export function openBillingPortal() {
  return request<{ portalUrl: string }>('/api/stripe/portal', { method: 'POST' });
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
