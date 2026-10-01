/**
 * Files a person has attached before, kept ON THIS DEVICE (IndexedDB) so they can be reused from the
 * composer's "+" menu without picking them again. Nothing here is uploaded anywhere until the file is
 * attached to a generation.
 *
 * Only reference types the studio accepts are kept (JPEG, PNG, WEBP), so anything shown can be reused.
 */
export interface RecentFile {
  id: string;
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

/** Same file picked twice (same name, size and modified time) is one entry. */
export function fileKey(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}|${file.size}|${file.lastModified}`;
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

/** Most recently used first. Never throws: storage can be unavailable (private mode, blocked). */
export async function listRecentFiles(): Promise<RecentFile[]> {
  try {
    const rows = await run<RecentFile[]>("readonly", (store) => store.getAll() as IDBRequest<RecentFile[]>);
    return rows
      .filter((row) => row?.file instanceof Blob)
      // Some browsers hand back a bare Blob without its name; rebuild a real File so it attaches correctly
      // and keeps the same identity (name, size, modified time) as the original.
      .map((row) => ({
        ...row,
        file: row.file instanceof File && row.file.name === row.name
          ? row.file
          : new File([row.file], row.name, { type: row.type, lastModified: row.lastModified }),
      }))
      .sort((a, b) => b.usedAt - a.usedAt);
  } catch { return []; }
}

/** Remembers (or bumps) files, then trims the oldest beyond the count and size limits. */
export async function rememberFiles(files: File[]): Promise<void> {
  const usable = files.filter((file) => ACCEPTED.includes(file.type));
  if (!usable.length) return;
  try {
    const now = Date.now();
    await Promise.all(usable.map((file, index) => run("readwrite", (store) =>
      store.put({ id: fileKey(file), name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, usedAt: now + index, file } satisfies RecentFile))));
    const all = await listRecentFiles();
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

export async function clearRecentFiles(): Promise<void> {
  try { await run("readwrite", (store) => store.clear()); } catch { /* ignore */ }
}
