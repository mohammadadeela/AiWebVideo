/**
 * After a new version is deployed, a tab that was opened before still asks for script and style files that no
 * longer exist (their names change on every build). The browser reports that as a failed dynamic import, and the
 * page used to end on the "workspace needs a quick reset" screen, unstyled because the stylesheet was gone too.
 * The right reaction is to load the new version once, automatically, without touching anyone's saved work.
 */
const STALE_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
  /loading (?:css )?chunk [\w-]+ failed/i,
  /chunkloaderror/i,
];

export function isStaleAssetError(error: unknown): boolean {
  const text = `${(error as { name?: string } | null)?.name ?? ""} ${(error as { message?: string } | null)?.message ?? String(error ?? "")}`;
  return STALE_PATTERNS.some((pattern) => pattern.test(text));
}

const KEY = "aiwebvideo_reloaded_for_new_version";
export const RELOAD_GUARD_MS = 2 * 60 * 1000;

/** True when it is fine to reload now: at most once per two minutes, so a real outage can never loop. */
export function mayReloadForNewVersion(storage: Pick<Storage, "getItem" | "setItem">, now = Date.now()): boolean {
  try {
    const last = Number(storage.getItem(KEY) ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(KEY, String(now));
    return true;
  } catch {
    // Storage is blocked: never risk a reload loop.
    return false;
  }
}

/** Loads the new version once. Returns true when a reload was started. */
export function reloadForNewVersion(): boolean {
  if (typeof window === "undefined" || !mayReloadForNewVersion(window.sessionStorage)) return false;
  window.location.reload();
  return true;
}

/** Vite fires this when a lazy chunk or its stylesheet cannot be loaded (typically after a deploy). */
export function installStaleAssetRecovery() {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
