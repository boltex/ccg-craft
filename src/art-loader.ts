import { getCachedFaceArt, putCachedFaceArt } from "./art-cache";
import {
    createSourceArtBitmap,
    normalizeFaceArtBitmap,
} from "./image-normalize";
import type { Card, PrintableFace } from "./types";
import * as utils from "./utils";

const scryfallMaxRetries = 5;

// Retry on HTTP 429 up to a capped number of attempts, honoring the retry-after header when present.
async function fetchWithRetry(url: string, delay: number): Promise<Response> {
    // First, respect the Scryfall API rate limit by sleeping for the configured delay.
    await utils.sleep(delay);
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(url);

        if (response.status === 429) {
            if (attempt >= scryfallMaxRetries) {
                throw new Error(`Rate limit exceeded after ${scryfallMaxRetries} retries for ${url}.`);
            }

            const retryAfterHeader = response.headers.get("retry-after");
            const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? "1", 10);
            const retryDelayMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000;

            await utils.sleep(retryDelayMs);
            continue;
        }

        return response;
    }
}

export type LoadFaceArtForCardInput = {
    card: Card;
    faces: Array<PrintableFace | undefined>;
};


export async function prepareFaceArtForCard(
    input: LoadFaceArtForCardInput
): Promise<void> {
    const artByFaceSerial = await loadFaceArtForCard(input);
    for (const bitmap of artByFaceSerial.values()) {
        bitmap.close();
    }
    // Now all the face art for the card has been prepared and cached locally.
}

export async function loadFaceArtForCard(
    input: LoadFaceArtForCardInput
): Promise<Map<number, ImageBitmap>> {

    // This function loads the face art for a given card, either from the local cache or by fetching and normalizing it from Scryfall.

    const faces = input.faces.filter(isPrintableFace);
    const artByFaceSerial = new Map<number, ImageBitmap>();
    const missingFaces: PrintableFace[] = [];

    for (const face of faces) {

        // If face type is 3, flip b, there is only central art, so no need to process it, it will be drawn from the flip a face.
        if (face.faceLayout === 3) {
            continue;
        }

        // Workaround for alternate art cards: if the card name ends with a number character, add 8192 to the face serial.
        let faceIndex = face.serial;
        if (/\d$/.test(input.card.name)) {
            // Capture digits at end   
            const match = input.card.name.match(/\d$/);
            const digit = match ? parseInt(match[0], 10) : 0;

            faceIndex = 8192 + (face.serial * 4) + digit; // There may be up to 3 other alternate art versions for this face.
            console.log(`Adjusted face index for alternate art: ${input.card.name}, new face index: ${faceIndex}`);
        }

        const cachedArt = await getCachedFaceArt(faceIndex);
        if (cachedArt) {
            artByFaceSerial.set(face.serial, await createImageBitmap(cachedArt.blob));
            continue;
        }

        missingFaces.push(face);
    }

    if (missingFaces.length === 0) {
        console.log(`All face art for card ${input.card.name} is already cached.`);
        return artByFaceSerial;
    }

    const artCropUrl = "https://cards.scryfall.io/art_crop/front/" + input.card.url;
    if (!artCropUrl) {
        console.log(`Failed to construct art crop URL for card ${input.card.name}.`);
        return artByFaceSerial;
    }

    const sourceBlob = await fetchSourceArtBlob(artCropUrl);
    const sourceBitmap = await createSourceArtBitmap(sourceBlob);

    try {
        for (const face of missingFaces) {
            let faceIndex = face.serial;
            if (/\d$/.test(input.card.name)) {
                // Capture digits at end   
                const match = input.card.name.match(/\d$/);
                const digit = match ? parseInt(match[0], 10) : 0;

                faceIndex = 8192 + (face.serial * 4) + digit; // There may be up to 3 other alternate art versions for this face.
                console.log(`Adjusted face index for alternate art: ${input.card.name}, new face index: ${faceIndex}`);
            }

            const normalizedArt = await normalizeFaceArtBitmap(sourceBitmap, face);
            const cachedArt = await putCachedFaceArt({
                faceSerial: faceIndex,
                blob: normalizedArt.blob,
            });

            // Set as original face.serial, not as modified faceIndex for alternate art.
            artByFaceSerial.set(face.serial, await createImageBitmap(cachedArt.blob));
        }
    } finally {
        sourceBitmap.close();
    }

    return artByFaceSerial;
}

function isPrintableFace(face: PrintableFace | undefined): face is PrintableFace {
    return face !== undefined;
}

async function fetchSourceArtBlob(artCropUrl: string): Promise<Blob> {
    const response = await fetchWithRetry(artCropUrl, 0); // no delay for image CDN requests
    if (!response.ok) {
        throw new Error(`Artwork fetch failed with HTTP ${response.status}.`);
    }

    return response.blob();
}
