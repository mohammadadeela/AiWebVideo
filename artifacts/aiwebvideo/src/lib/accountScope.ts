import { clearActiveJobId } from "./guestSession";
import { clearPublicCreatorHandoff } from "./publicCreatorHandoff";
import { clearPendingSample } from "./showcase";

/**
 * Nothing that belongs to one account may be visible to the next account that signs in on the same browser.
 *
 * Kept per account already: the "Recent files" in the "+" menu (IndexedDB, keyed by the account's email).
 * Cleared here when the signed-in account changes or someone signs out:
 *   - the active project the browser would reopen (`aiwebvideo_active_job`)
 *   - saved production drafts (`aiwebvideo_workflow_*`) - they contain the person's own prompts
 *   - a request or example waiting to continue after sign-in
 *
 * The very first sign-in after browsing as a guest is NOT a change of account: the guest's project is
 * deliberately carried into the new account.
 */
const LAST_ACCOUNT_KEY = "aiwebvideo_last_account";
const WORKFLOW_PREFIX = "aiwebvideo_workflow_";

export function clearAccountScopedState() {
  clearActiveJobId();
  clearPublicCreatorHandoff();
  clearPendingSample();
  try {
    const stale: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(WORKFLOW_PREFIX)) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch { /* storage can be unavailable */ }
}

/**
 * Call with the signed-in account's email whenever the session is verified (and with null when signed out).
 * Returns true when a DIFFERENT account just replaced the previous one on this browser.
 */
export function reconcileAccount(email: string | null | undefined): boolean {
  const current = (email ?? "").trim().toLowerCase();
  if (!current) return false;
  try {
    const previous = localStorage.getItem(LAST_ACCOUNT_KEY);
    localStorage.setItem(LAST_ACCOUNT_KEY, current);
    if (previous && previous !== current) {
      clearAccountScopedState();
      return true;
    }
  } catch { /* storage can be unavailable */ }
  return false;
}

/** Signing out forgets whose browser this was, so the next person starts clean. */
export function forgetAccountOnSignOut() {
  clearAccountScopedState();
  try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch { /* ignore */ }
}
