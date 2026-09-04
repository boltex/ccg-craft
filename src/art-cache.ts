import { Unzip, UnzipInflate, zipSync, type UnzipFile, type Zippable } from "fflate";
import type { CachedFaceArt, CachedFaceArtInput, CardFace } from "./types";

const ART_CACHE_DB_NAME = "ccg-craft-art";
const ART_CACHE_DB_VERSION = 2;
const FACE_ART_STORE_NAME = "faceArt";
const ART_CACHE_ZIP_ENTRY_PATTERN = /^(\d+)\.webp$/i;
const ART_CACHE_IMPORT_BATCH_SIZE = 200;

let databasePromise: Promise<IDBDatabase> | undefined;

function getArtCacheDatabase(): Promise<IDBDatabase> {
    if (!databasePromise) {
        databasePromise = openArtCacheDatabase();
    }
    return databasePromise;
}

function openArtCacheDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(ART_CACHE_DB_NAME, ART_CACHE_DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            const transaction = request.transaction;
            const store = database.objectStoreNames.contains(FACE_ART_STORE_NAME)
                ? transaction?.objectStore(FACE_ART_STORE_NAME)
                : database.createObjectStore(FACE_ART_STORE_NAME, {
                    keyPath: "faceSerial",
                });

            if (!store) {
                return;
            }

            if (store.indexNames.contains("cachedAt")) {
                store.deleteIndex("cachedAt");
            }

            if (request.transaction && request.transaction.db.version >= 2) {
                migrateFaceArtStore(store);
            }
        };

        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => {
                database.close();
                databasePromise = undefined;
            };
            resolve(database);
        };

        request.onerror = () => {
            reject(request.error ?? new Error("Failed to open the art cache database."));
        };

        request.onblocked = () => {
            reject(new Error("Opening the art cache database was blocked by another tab."));
        };
    });
}

function normalizeCachedFaceArt(input: CachedFaceArtInput): CachedFaceArt {
    return {
        faceSerial: input.faceSerial,
        blob: input.blob,
    };
}

function migrateFaceArtStore(store: IDBObjectStore): void {
    const request = store.openCursor();

    request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
            return;
        }

        const normalizedRecord = normalizeCachedFaceArt(cursor.value as CachedFaceArtInput);
        cursor.update(normalizedRecord);
        cursor.continue();
    };

    request.onerror = () => {
        throw request.error ?? new Error("Failed to migrate art cache records.");
    };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error ?? new Error("IndexedDB request failed."));
        };
    });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        };

        transaction.onabort = () => {
            reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
        };
    });
}

async function getAllCachedFaceArt(): Promise<CachedFaceArt[]> {
    const database = await getArtCacheDatabase();
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readonly");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);
    const request = store.getAll();

    const records = await requestToPromise(request) as CachedFaceArt[];
    await waitForTransaction(transaction);

    return records;
}

export async function getCachedFaceArt(faceSerial: number): Promise<CachedFaceArt | undefined> {
    const database = await getArtCacheDatabase();
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readonly");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);
    const request = store.get(faceSerial);

    const record = await requestToPromise(request) as CachedFaceArt | undefined;
    await waitForTransaction(transaction);

    return record;
}

export async function putCachedFaceArt(input: CachedFaceArtInput): Promise<CachedFaceArt> {
    const database = await getArtCacheDatabase();
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readwrite");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);
    const record = normalizeCachedFaceArt(input);

    store.put(record);
    await waitForTransaction(transaction);

    return record;
}

export async function deleteCachedFaceArt(faceSerial: number): Promise<void> {
    const database = await getArtCacheDatabase();
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readwrite");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);

    store.delete(faceSerial);
    await waitForTransaction(transaction);
}

export async function clearCachedFaceArt(): Promise<void> {
    const database = await getArtCacheDatabase();
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readwrite");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);

    store.clear();
    await waitForTransaction(transaction);
}

export async function getCachedFaceArtCount(): Promise<number> {
    const database = await getArtCacheDatabase();
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readonly");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);
    const request = store.count();

    const count = await requestToPromise(request);
    await waitForTransaction(transaction);

    return count;
}

export async function exportCachedFaceArt(): Promise<Blob> {
    const records = await getAllCachedFaceArt();
    const files: Zippable = {};

    for (const record of records) {
        files[`${record.faceSerial}.webp`] = new Uint8Array(await record.blob.arrayBuffer());
    }

    // Images are already WebP-compressed, so DEFLATE (level > 0) would just burn CPU for no size benefit.
    const zipped = zipSync(files, { level: 0 });

    return new Blob([zipped], { type: "application/zip" });
}

export async function importCachedFaceArt(file: Blob): Promise<{ importedCount: number; totalCount: number; }> {
    const database = await getArtCacheDatabase();

    let importedCount = 0;
    let batch: CachedFaceArtInput[] = [];
    let pendingWrite = Promise.resolve();

    const flushBatch = (): void => {
        if (batch.length === 0) {
            return;
        }
        const recordsToWrite = batch;
        batch = [];
        pendingWrite = pendingWrite.then(() => writeCachedFaceArtBatch(database, recordsToWrite));
    };

    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (entry: UnzipFile) => {
        const match = entry.name.match(ART_CACHE_ZIP_ENTRY_PATTERN);
        if (!match) {
            return;
        }

        const faceSerial = Number.parseInt(match[1], 10);
        const chunks: Uint8Array[] = [];
        entry.ondata = (error, chunk, final) => {
            if (error) {
                throw error;
            }

            chunks.push(chunk);
            if (!final) {
                return;
            }

            batch.push({
                faceSerial,
                blob: new Blob(chunks as BlobPart[], { type: "image/webp" }),
            });
            importedCount += 1;
            if (batch.length >= ART_CACHE_IMPORT_BATCH_SIZE) {
                flushBatch();
            }
        };
        entry.start();
    };

    // Stream the zip in chunks instead of using unzipSync, since decompressing a large archive all at
    // once would hold every extracted image in memory simultaneously.
    const reader = file.stream().getReader();
    try {
        for (; ;) {
            const { value, done } = await reader.read();
            if (done) {
                unzip.push(new Uint8Array(0), true);
                break;
            }
            unzip.push(value, false);
        }
    } finally {
        reader.releaseLock();
    }

    flushBatch();
    await pendingWrite;

    return {
        importedCount,
        totalCount: await getCachedFaceArtCount(),
    };
}

async function writeCachedFaceArtBatch(database: IDBDatabase, records: CachedFaceArtInput[]): Promise<void> {
    const transaction = database.transaction(FACE_ART_STORE_NAME, "readwrite");
    const store = transaction.objectStore(FACE_ART_STORE_NAME);

    for (const record of records) {
        store.put(normalizeCachedFaceArt(record));
    }

    await waitForTransaction(transaction);
}
