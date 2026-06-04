import type { LabDocument } from "../types";

const DB_NAME = "algoarena-v2";
const STORE_NAME = "labs";
const SETTINGS_STORE_NAME = "settings";
const DB_VERSION = 2;
const FALLBACK_KEY = "algoarena-labs-fallback";
const DIRECTORY_HANDLE_KEY = "lab-directory-handle";

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  requestPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  queryPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

const hasIndexedDb = (): boolean => typeof indexedDB !== "undefined";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = fn(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};

const withNamedStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = fn(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};

const readFallbackLabs = (): LabDocument[] => {
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as LabDocument[]) : [];
  } catch {
    return [];
  }
};

const writeFallbackLabs = (labs: LabDocument[]): void => {
  window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(labs));
};

export const listLabs = async (): Promise<LabDocument[]> => {
  if (!hasIndexedDb()) {
    return readFallbackLabs();
  }
  try {
    return await withStore<LabDocument[]>("readonly", (store) => store.getAll() as IDBRequest<LabDocument[]>);
  } catch {
    return readFallbackLabs();
  }
};

export const saveLab = async (lab: LabDocument): Promise<void> => {
  if (!hasIndexedDb()) {
    const labs = readFallbackLabs().filter((item) => item.id !== lab.id);
    writeFallbackLabs([...labs, lab]);
    return;
  }
  try {
    await withStore<IDBValidKey>("readwrite", (store) => store.put(lab));
  } catch {
    const labs = readFallbackLabs().filter((item) => item.id !== lab.id);
    writeFallbackLabs([...labs, lab]);
  }
};

export const deleteLab = async (labId: string): Promise<void> => {
  if (!hasIndexedDb()) {
    writeFallbackLabs(readFallbackLabs().filter((item) => item.id !== labId));
    return;
  }
  try {
    await withStore<undefined>("readwrite", (store) => store.delete(labId) as IDBRequest<undefined>);
  } catch {
    writeFallbackLabs(readFallbackLabs().filter((item) => item.id !== labId));
  }
};

const safeFileName = (title: string): string => {
  const cleaned = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${cleaned || "algoarena-lab"}.algoarena`;
};

const verifyPermission = async (directoryHandle: FileSystemDirectoryHandle): Promise<boolean> => {
  if (directoryHandle.queryPermission) {
    const current = await directoryHandle.queryPermission({ mode: "readwrite" });
    if (current === "granted") {
      return true;
    }
  }
  if (directoryHandle.requestPermission) {
    return (await directoryHandle.requestPermission({ mode: "readwrite" })) === "granted";
  }
  return true;
};

export const canChooseLabDirectory = (): boolean => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function" && hasIndexedDb();

export const chooseLabDirectory = async (): Promise<string> => {
  if (!canChooseLabDirectory() || !window.showDirectoryPicker) {
    throw new Error("Directory selection is not supported in this environment.");
  }
  const directoryHandle = await window.showDirectoryPicker();
  const permitted = await verifyPermission(directoryHandle);
  if (!permitted) {
    throw new Error("Permission denied for the selected directory.");
  }
  await withNamedStore<IDBValidKey>(SETTINGS_STORE_NAME, "readwrite", (store) => store.put(directoryHandle, DIRECTORY_HANDLE_KEY));
  return directoryHandle.name;
};

export const getLabDirectoryName = async (): Promise<string | null> => {
  if (!hasIndexedDb()) {
    return null;
  }
  try {
    const handle = await withNamedStore<FileSystemDirectoryHandle | undefined>(
      SETTINGS_STORE_NAME,
      "readonly",
      (store) => store.get(DIRECTORY_HANDLE_KEY) as IDBRequest<FileSystemDirectoryHandle | undefined>
    );
    return handle?.name ?? null;
  } catch {
    return null;
  }
};

export const saveLabToChosenDirectory = async (lab: LabDocument): Promise<string | null> => {
  if (!hasIndexedDb()) {
    return null;
  }
  const handle = await withNamedStore<FileSystemDirectoryHandle | undefined>(
    SETTINGS_STORE_NAME,
    "readonly",
    (store) => store.get(DIRECTORY_HANDLE_KEY) as IDBRequest<FileSystemDirectoryHandle | undefined>
  );
  if (!handle) {
    return null;
  }
  const permitted = await verifyPermission(handle);
  if (!permitted) {
    throw new Error("Permission denied for the configured Lab directory.");
  }
  const fileName = safeFileName(lab.title);
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(lab, null, 2));
  await writable.close();
  return `${handle.name}/${fileName}`;
};

export const encodeLabForUrl = (lab: LabDocument): string => {
  const json = JSON.stringify(lab);
  return btoa(unescape(encodeURIComponent(json)));
};

export const decodeLabFromUrl = (encoded: string): LabDocument => {
  const json = decodeURIComponent(escape(atob(encoded)));
  return JSON.parse(json) as LabDocument;
};
