import { getCachedFaceArt, putCachedFaceArt } from "./art-cache";
import {
    createSourceArtBitmap,
    normalizeFaceArtBitmap,
} from "./image-normalize";
import type { card, PrintableFace } from "./types";

const scryfallSearchUrl = "https://api.scryfall.com/cards/search";

export type LoadFaceArtForCardInput = {
    card: card;
    faces: Array<PrintableFace | undefined>;
    scryfallEditions: string[];
};

export async function loadFaceArtForCard(
    input: LoadFaceArtForCardInput
): Promise<Map<number, ImageBitmap>> {
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
    const response = await fetch(`${scryfallSearchUrl}?q=${query}`);

    if (!response.ok) {
        throw new Error(`Scryfall search failed with HTTP ${response.status}.`);
    }

    const json = await response.json() as ScryfallSearchResponse;
    const firstMatch = json.data?.[0]; // Choose the first match for now, maybe when there's sets of 4 the 3rd one is best but we'll see.
    return firstMatch?.image_uris?.art_crop;
}

async function fetchSourceArtBlob(artCropUrl: string): Promise<Blob> {
    const response = await fetch(artCropUrl);
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