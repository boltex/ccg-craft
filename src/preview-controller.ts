import { loadFaceArtForCard } from "./art-loader";
import { renderCardPreview } from "./renderer";
import type { Card, PrintableFace } from "./types";
import * as utils from "./utils";

export type PreviewState = {
    card: Card;
    faces: [PrintableFace, PrintableFace | undefined];
};

// Owns the preview canvas, the currently shown card, and the lifecycle of its loaded art bitmaps.
export class CardPreviewController {
    private renderedFaceArt = new Map<number, ImageBitmap>();
    private previewState: PreviewState | null = null;

    constructor(private readonly canvasElement: HTMLCanvasElement | null) { }

    get currentCard(): Card | null {
        return this.previewState?.card ?? null;
    }

    async showCard(
        card: Card,
        faces: [PrintableFace, PrintableFace | undefined],
        editions: readonly string[],
        editionsScry: Readonly<Record<string, string[]>>,
        frameBackgroundsImageBitmap: Record<number, ImageBitmap>
    ): Promise<string> {
        const possibleCardEditions = editionsScry[card.edition];
        if (!possibleCardEditions || possibleCardEditions.length === 0) {
            throw new Error(`No editions found for card: ${card.name} (edition: ${card.edition})`);
        }

        this.releaseRenderedFaceArt();

        try {
            this.renderedFaceArt = await loadFaceArtForCard({ card, faces });
        } catch (error) {
            console.error(`Error fetching card data for ${card.name}:`, error);
            throw error;
        }

        const context = this.canvasElement?.getContext("2d");
        if (context) {
            renderCardPreview(context, faces, {
                padding: 20,
                background: "#f3ecdf",
                artByFaceSerial: this.renderedFaceArt,
                frameBackgroundsImageBitmap: frameBackgroundsImageBitmap
            });
        }

        this.previewState = { card, faces };
        return formatPreviewText(card, faces, editions);
    }

    clear(): void {
        this.previewState = null;
        this.releaseRenderedFaceArt();
        utils.clearCanvas(this.canvasElement);
    }

    private releaseRenderedFaceArt(): void {
        for (const artBitmap of this.renderedFaceArt.values()) {
            artBitmap.close();
        }
        this.renderedFaceArt = new Map<number, ImageBitmap>();
    }
}

function formatPreviewText(
    card: Card,
    faces: [PrintableFace, PrintableFace | undefined],
    editions: readonly string[]
): string {
    let previewText = `Card: ${card.name} (Edition: ${card.edition})`;
    for (const face of faces) {
        if (!face) {
            continue;
        }
        const faceName = face.name || "Unknown";
        const faceEdition = editions[face.edition] || "Unknown"; // ( zero based )
        const faceManaCost = face.manaCost || "Unknown";
        const faceTypeLine = face.typeLine || "Unknown";
        const facePowerToughness = face.isACreature ? `${face.powerToughness}` : "N/A";
        const faceTextLines = face.textLines.join("\n");

        previewText += `
            ---------------
            Face ${face.serial}:
            Name: ${faceName}
            Mana Cost: ${faceManaCost}
            Type Line: ${faceTypeLine}
            Edition: ${faceEdition}  
            Power/Toughness: ${facePowerToughness}
            Text:
            ${faceTextLines}`;
    }
    return previewText.replace(/^\s+/gm, ''); // Remove spaces before newlines for better formatting
}
