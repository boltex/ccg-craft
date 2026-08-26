import type { CachedFaceArt, CachedFaceArtInput, cardFace } from "./types";

const ART_CACHE_DB_NAME = "ccg-craft-art";
const ART_CACHE_DB_VERSION = 1;
const FACE_ART_STORE_NAME = "faceArt";
const FACE_ART_CACHED_AT_INDEX = "cachedAt";
const ART_CACHE_EXPORT_FORMAT = "ccg-craft-art-cache";
const ART_CACHE_EXPORT_VERSION = 1;

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
    const serializedRecords = await Promise.all(records.map(serializeCachedFaceArt));

    const exportPayload: ArtCacheExportFile = {
        format: ART_CACHE_EXPORT_FORMAT,
        version: ART_CACHE_EXPORT_VERSION,
        exportedAt: Date.now(),
        records: serializedRecords,
    };

    return new Blob([
        JSON.stringify(exportPayload, null, 2)
    ], {
        type: "application/json",
    });
}

export async function importCachedFaceArt(file: Blob): Promise<{ importedCount: number; totalCount: number; }> {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<ArtCacheExportFile>;

    if (parsed.format !== ART_CACHE_EXPORT_FORMAT || parsed.version !== ART_CACHE_EXPORT_VERSION || !Array.isArray(parsed.records)) {
        throw new Error("The selected file is not a valid CCG Craft art cache export.");
    }

    let importedCount = 0;
    for (const record of parsed.records) {
        if (!isSerializedCachedFaceArt(record)) {
            throw new Error("The selected file contains an invalid art cache record.");
        }

        const blob = base64ToBlob(record.dataBase64, record.mimeType);
        await putCachedFaceArt({
            faceSerial: record.faceSerial,
            blob,
            width: record.width,
            height: record.height,
            cachedAt: record.cachedAt,
        });
        importedCount += 1;
    }

    return {
        importedCount,
        totalCount: await getCachedFaceArtCount(),
    };
}

export async function logCachedFaceArt(faceData: cardFace[], faceNames: string[]): Promise<void> {
    // Logs to the console the names of the faces in the cache, sorted by cachedAt descending.
    const records = await getAllCachedFaceArt();
    records.sort((a, b) => b.cachedAt - a.cachedAt);
    console.log("Cached Face Art Records:");
    for (const record of records) {
        const face = faceData[record.faceSerial - 1];
        const name = faceNames[face.nameIndex - 1];
        // console.log(`Face Serial: ${record.faceSerial}, Name: ${name}, Cached At: ${new Date(record.cachedAt).toLocaleString()}`);
        // Just the name
        console.log(name);
    }
}


async function serializeCachedFaceArt(record: CachedFaceArt): Promise<SerializedCachedFaceArt> {
    return {
        faceSerial: record.faceSerial,
        width: record.width,
        height: record.height,
        cachedAt: record.cachedAt,
        mimeType: record.blob.type || "application/octet-stream",
        dataBase64: await blobToBase64(record.blob),
    };
}

function isSerializedCachedFaceArt(value: unknown): value is SerializedCachedFaceArt {
    if (!value || typeof value !== "object") {
        return false;
    }

    const record = value as Partial<SerializedCachedFaceArt>;
    return typeof record.faceSerial === "number"
        && typeof record.width === "number"
        && typeof record.height === "number"
        && typeof record.cachedAt === "number"
        && typeof record.mimeType === "string"
        && typeof record.dataBase64 === "string";
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Failed to read cached art blob."));
                return;
            }

            const commaIndex = result.indexOf(",");
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error("Failed to read cached art blob."));
        };
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(dataBase64: string, mimeType: string): Blob {
    const binary = atob(dataBase64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
}

type SerializedCachedFaceArt = {
    faceSerial: number;
    width: number;
    height: number;
    cachedAt: number;
    mimeType: string;
    dataBase64: string;
};

type ArtCacheExportFile = {
    format: typeof ART_CACHE_EXPORT_FORMAT;
    version: typeof ART_CACHE_EXPORT_VERSION;
    exportedAt: number;
    records: SerializedCachedFaceArt[];
};