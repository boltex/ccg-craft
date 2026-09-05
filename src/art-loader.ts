import { getCachedFaceArt, putCachedFaceArt } from "./art-cache";
import {
    createSourceArtBitmap,
    normalizeFaceArtBitmap,
} from "./image-normalize";
import type { Card, PrintableFace } from "./types";
import * as utils from "./utils";

const scryfallSearchUrl = "https://api.scryfall.com/cards/search";
const scryfallRequestDelayMs = 500;
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
    scryfallEditions: string[];
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

        const cachedArt = await getCachedFaceArt(face.serial);
        if (cachedArt) {
            artByFaceSerial.set(face.serial, await createImageBitmap(cachedArt.blob));
            continue;
        }

        missingFaces.push(face);
    }

    if (missingFaces.length === 0) {
        return artByFaceSerial;
    }

    const editionToUse = selectScryfallEdition(input.card.name, input.scryfallEditions);
    const artCropUrl = await fetchArtCropUrl(input.card.name, editionToUse);
    if (!artCropUrl) {
        return artByFaceSerial;
    }

    const sourceBlob = await fetchSourceArtBlob(artCropUrl);
    const sourceBitmap = await createSourceArtBitmap(sourceBlob);

    try {
        for (const face of missingFaces) {
            const normalizedArt = await normalizeFaceArtBitmap(sourceBitmap, face);
            const cachedArt = await putCachedFaceArt({
                faceSerial: face.serial,
                blob: normalizedArt.blob,
            });

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

function selectScryfallEdition(cardName: string, scryfallEditions: string[]): string {
    if (scryfallEditions.length === 0) {
        throw new Error(`No Scryfall editions available for ${cardName}.`);
    }

    if (cardName === "Nalathni Dragon" && scryfallEditions.includes("PDRC")) {
        return "PDRC";
    }

    return scryfallEditions[0];
}

async function fetchArtCropUrl(cardName: string, edition: string): Promise<string | undefined> {
    // Scryfall search query: name:"Card Name" e:EDITION unique:art 
    // We need to replace vertical bar to double slash for cards like assault | battery which should be searched as "assault // battery" in Scryfall.
    cardName = cardName.replace("|", "//");

    const query = encodeURIComponent(`name:"${cardName}" e:${edition} unique:art`);
    const response = await fetchWithRetry(`${scryfallSearchUrl}?q=${query}`, scryfallRequestDelayMs);

    if (!response.ok) {
        throw new Error(`Scryfall search failed with HTTP ${response.status}.`);
    }

    const json = await response.json() as ScryfallSearchResponse;
    const firstMatch = json.data?.[0]; // Choose the first match for now, maybe when there's sets of 4 the 3rd one is best but we'll see.
    return firstMatch?.image_uris?.art_crop;
}

async function fetchSourceArtBlob(artCropUrl: string): Promise<Blob> {
    const response = await fetchWithRetry(artCropUrl, 0); // no delay for image CDN requests
    if (!response.ok) {
        throw new Error(`Artwork fetch failed with HTTP ${response.status}.`);
    }

    return response.blob();
}

type ScryfallSearchResponse = {
    data?: ScryfallCardResult[];
};

type ScryfallCardResult = {
    image_uris?: {
        art_crop?: string;
    };
};