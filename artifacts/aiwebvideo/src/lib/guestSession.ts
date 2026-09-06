// Tracks the chat/job the visitor is currently working on so that signing in
// (from the homepage chat, the paywall, or the nav "Log in" button) can carry
// it into the dashboard instead of dropping the person back at a blank chat.
// localStorage is intentional: a refresh, browser restart, navigation, or
// sign-out must not lose the production the person was working on. It is
// cleared only when they explicitly start a new project.

const KEY = 'aiwebvideo_active_job';

export function setActiveJobId(jobId: string) {
  try { localStorage.setItem(KEY, jobId); } catch { /* storage unavailable (private mode, etc.) */ }
}

export function getActiveJobId(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearActiveJobId() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Builds the right post-sign-in destination without discarding the resumable project. */
export function resolveDashboardDestination(): string {
  const jobId = getActiveJobId();
  return jobId ? `/dashboard?job=${encodeURIComponent(jobId)}` : '/dashboard';
}
