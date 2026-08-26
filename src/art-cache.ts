import type { CachedFaceArt, CachedFaceArtInput } from "./types";

const ART_CACHE_DB_NAME = "ccg-craft-art";
const ART_CACHE_DB_VERSION = 1;
const FACE_ART_STORE_NAME = "faceArt";
const FACE_ART_CACHED_AT_INDEX = "cachedAt";

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
            const store = database.objectStoreNames.contains(FACE_ART_STORE_NAME)
                ? request.transaction?.objectStore(FACE_ART_STORE_NAME)
                : database.createObjectStore(FACE_ART_STORE_NAME, {
                    keyPath: "faceSerial",
                });

            if (store && !store.indexNames.contains(FACE_ART_CACHED_AT_INDEX)) {
                store.createIndex(FACE_ART_CACHED_AT_INDEX, FACE_ART_CACHED_AT_INDEX);
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
        width: input.width,
        height: input.height,
        cachedAt: input.cachedAt ?? Date.now(),
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