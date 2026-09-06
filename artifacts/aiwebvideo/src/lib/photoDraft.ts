export interface SavedPhotoDraftItem {
  id: string;
  file: File;
  source: 'paste' | 'picker';
}

interface SavedPhotoDraft {
  key: string;
  photos: SavedPhotoDraftItem[];
  updatedAt: number;
}

const DATABASE = 'aiwebvideo-local-drafts';
const STORE = 'photo-drafts';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Local draft storage is unavailable.'));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local draft storage.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not update the local draft.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The local draft update was interrupted.'));
    });
  } finally {
    database.close();
  }
}

export async function loadPhotoDraft(key: string): Promise<SavedPhotoDraftItem[]> {
  const draft = await transact<SavedPhotoDraft | undefined>('readonly', (store) => store.get(key));
  return Array.isArray(draft?.photos) ? draft.photos.filter((item) => item?.file instanceof Blob) : [];
}

export async function savePhotoDraft(key: string, photos: SavedPhotoDraftItem[]): Promise<void> {
  await transact<IDBValidKey>('readwrite', (store) => store.put({ key, photos, updatedAt: Date.now() } satisfies SavedPhotoDraft));
}

export async function clearPhotoDraft(key: string): Promise<void> {
  await transact<undefined>('readwrite', (store) => store.delete(key));
}
