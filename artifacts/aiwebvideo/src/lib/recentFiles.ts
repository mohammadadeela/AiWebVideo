/**
 * Files a signed-in person has attached before, kept ON THIS DEVICE (IndexedDB) so they can be reused from
 * the composer's "+" menu without picking them again. Nothing here is uploaded anywhere until the file is
 * attached to a generation.
 *
 * - Only for signed-in people: with no owner nothing is remembered and nothing is listed.
 * - Every record belongs to one account (its email). Someone else signing in on the same computer never
 *   sees them, and older records from before accounts were tracked are discarded.
 * - Only reference types the studio accepts are kept (JPEG, PNG, WEBP), so anything shown can be reused.
 */
export interface RecentFile {
  /** Unique per account: `${owner}|${key}`. */
  id: string;
  /** The same file picked twice (same name, size and modified time) has the same key. */
  key: string;
  owner: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  usedAt: number;
  file: File;
}

const DATABASE = "aiwebvideo-recent-files";
const STORE = "files";
const MAX_FILES = 24;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function fileKey(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function normalizeOwner(owner: string | null | undefined) {
  return (owner ?? "").trim().toLowerCase();
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("unavailable")); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("unavailable"));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}

/** This account's files, most recently used first. Never throws: storage can be unavailable. */
export async function listRecentFiles(owner: string | null | undefined): Promise<RecentFile[]> {
  const who = normalizeOwner(owner);
  if (!who) return [];
  try {
    const rows = await run<RecentFile[]>("readonly", (store) => store.getAll() as IDBRequest<RecentFile[]>);
    // Records written before accounts were tracked have no owner: they are not anyone's, so drop them.
    const orphans = rows.filter((row) => !row?.owner).map((row) => row?.id).filter((id): id is string => typeof id === "string");
    if (orphans.length) void Promise.all(orphans.map((id) => run("readwrite", (store) => store.delete(id)))).catch(() => {});
    return rows
      .filter((row) => row?.owner === who && row.file instanceof Blob)
      // Some browsers hand back a bare Blob without its name; rebuild a real File so it attaches correctly.
      .map((row) => ({
        ...row,
        file: row.file instanceof File && row.file.name === row.name
          ? row.file
          : new File([row.file], row.name, { type: row.type, lastModified: row.lastModified }),
      }))
      .sort((a, b) => b.usedAt - a.usedAt);
  } catch { return []; }
}

/** Remembers (or bumps) files for this account, then trims its oldest beyond the count and size limits. */
export async function rememberFiles(files: File[], owner: string | null | undefined): Promise<void> {
  const who = normalizeOwner(owner);
  const usable = files.filter((file) => ACCEPTED.includes(file.type));
  if (!who || !usable.length) return;
  try {
    const now = Date.now();
    await Promise.all(usable.map((file, index) => run("readwrite", (store) => {
      const key = fileKey(file);
      return store.put({ id: `${who}|${key}`, key, owner: who, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, usedAt: now + index, file } satisfies RecentFile);
    })));
    const all = await listRecentFiles(who);
    let total = 0;
    const stale: string[] = [];
    all.forEach((row, index) => {
      total += row.size;
      if (index >= MAX_FILES || total > MAX_TOTAL_BYTES) stale.push(row.id);
    });
    await Promise.all(stale.map((id) => run("readwrite", (store) => store.delete(id))));
  } catch { /* the library is a convenience; attaching still works without it */ }
}

export async function forgetRecentFile(id: string): Promise<void> {
  try { await run("readwrite", (store) => store.delete(id)); } catch { /* ignore */ }
}

/** Removes only this account's files. */
export async function clearRecentFiles(owner: string | null | undefined): Promise<void> {
  const mine = await listRecentFiles(owner);
  await Promise.all(mine.map((row) => forgetRecentFile(row.id)));
}
