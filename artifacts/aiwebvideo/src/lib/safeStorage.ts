/**
 * Some browsers (in-app browsers such as the Google, Instagram or Facebook apps, hardened or private modes) throw an
 * error the moment code even READS `localStorage` or `sessionStorage`. One such read anywhere used to take the whole
 * page down. Imported first, this replaces a blocked storage with a working in-memory one, so nothing in the app can
 * be crashed by storage again (values then simply last until the page is closed).
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(String(key), String(value)); }
  [name: string]: unknown;
}

export function storageWorks(kind: "localStorage" | "sessionStorage", scope: Window = window): boolean {
  try {
    const store = scope[kind];
    const probe = "__aiwebvideo_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch { return false; }
}

/** Returns which storages had to be replaced (empty when the browser's own storage works). */
export function installSafeStorage(scope: Window = window): string[] {
  const replaced: string[] = [];
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    if (storageWorks(kind, scope)) continue;
    try {
      Object.defineProperty(scope, kind, { value: new MemoryStorage(), configurable: true, writable: true });
      replaced.push(kind);
    } catch { /* nothing more can be done */ }
  }
  return replaced;
}

if (typeof window !== "undefined") installSafeStorage();
