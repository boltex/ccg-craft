import * as constants from "./constants";
import PDFDocument from "pdfkit";
import { toBlob } from "pdfkit/output";
import { renderCardToSurface, type RenderCardOptions } from "./renderer";
import {
    createPdfKitRenderSurface,
    registerPdfKitFont,
    type PdfKitDocument,
    type PdfKitFontRegistry,
    type PdfKitImageSource,
} from "./renderer-surface-pdfkit";
import type { RenderImageSource } from "./renderer-surface";
import type { Card, PrintableFace } from "./types";
import { loadFaceArtForCard } from "./art-loader";

export type GenerateSingleCardPdfInput = {
    faces: Array<PrintableFace | undefined>;
    artByFaceSerial?: ReadonlyMap<number, RenderImageSource>;
    pageBackground?: string;
    renderOptions?: Omit<RenderCardOptions, "artByFaceSerial">;
};

type PdfKitDocumentConstructor = new (options?: Record<string, unknown>) => PdfKitDocumentWithOutput;

type PdfKitDocumentWithOutput = PdfKitDocument & {
    addPage(options?: { size?: [number, number]; margin?: number }): PdfKitDocumentWithOutput;
    end(): void;
    on(event: string, listener: (...args: unknown[]) => void): PdfKitDocumentWithOutput;
    off(event: string, listener: (...args: unknown[]) => void): PdfKitDocumentWithOutput;
};

let pdfFontsPromise: Promise<PdfFontBytes> | undefined;

// export async generateDeckPdf
export type GenerateDeckPdfInput = {
    cards: Card[];
    getFaceData: (cardSerial: number) => [PrintableFace, PrintableFace | undefined];
    paperSize?: string;
    pageBackground?: string;
    renderOptions?: Omit<RenderCardOptions, "artByFaceSerial">;
};

const PDF_FONT_ALIASES: PdfKitFontRegistry = {
    regularText: "PlantinPdf",
    titleText: "MedievalPdf",
    manaSymbols: "SymbolsPdf",
    expansionFront: "ExpFrontPdf",
    expansionBack: "ExpBackPdf",
};

const PDF_FONT_FILES: Array<{ alias: keyof PdfKitFontRegistry; path: string }> = [
    { alias: "regularText", path: "plantin.ttf" },
    { alias: "titleText", path: "medieval.ttf" },
    { alias: "manaSymbols", path: "symbols.ttf" },
    { alias: "expansionFront", path: "expansions-f.ttf" },
    { alias: "expansionBack", path: "expansions-b.ttf" },
];

const SHEET_COLUMNS = 3;
const SHEET_ROWS = 3;
const CROP_MARK_GAP = 4;
const CROP_MARK_LENGTH = 10;
const CROP_MARK_LINE_WIDTH = 0.5;
const CROP_MARK_COLOR = "#000000";

export async function generateDeckPdf(input: GenerateDeckPdfInput, logFunction?: (message: string) => void): Promise<Blob> {

    const PdfDocument = PDFDocument as unknown as PdfKitDocumentConstructor;
    const document = new PdfDocument({
        autoFirstPage: false,
        margin: 0,
        compress: true,
        font: null,
    });

    const outputPromise = toBlob(document);

    document.addPage({
        size: constants.SpecificPageSizes[input.paperSize ?? "letter"],
        margin: 0,
    });
    fillPdfPageBackground(document, input.pageBackground ?? "#ffffff");

    const fontBytes = await loadPdfFontBytes();
    registerPdfFonts(document, fontBytes);

    let cardPointer = 0; // Pointer to keep track of the current card being processed in the deck.
    // we either are going to do 3 x 3 or 6 x 3.
    const maxSheetRows = SHEET_ROWS;
    let maxSheetColumns = SHEET_COLUMNS;
    if (input.paperSize === "ledger" || input.paperSize === "a3") {
        maxSheetColumns = maxSheetColumns * 2; // 6 columns for ledger or a3 paper size.
    }

    const gridWidth = constants.PdfCardWidth * maxSheetColumns;
    const gridHeight = constants.PdfCardHeight * maxSheetRows;
    const [pageWidth, pageHeight] = constants.SpecificPageSizes[input.paperSize ?? "letter"];
    const gridOriginX = (pageWidth - gridWidth) / 2;
    const gridOriginY = (pageHeight - gridHeight) / 2;

    let pageCount = 1; // Keep track of the current page number.

    while (cardPointer < input.cards.length) {
        // Process each card and place it on the sheet according to maxSheetRows and maxSheetColumns.
        // This is where the logic for arranging cards on the PDF page will go.

        if (logFunction) {
            logFunction(`Starting page ${pageCount}`);
        }

        for (let row = 0; row < maxSheetRows; row++) {
            for (let column = 0; column < maxSheetColumns; column++) {
                if (cardPointer >= input.cards.length) {
                    break;
                }
                const card = input.cards[cardPointer];
                const faces = input.getFaceData(card.serial);

                const rawArtByFaceSerial = await loadFaceArtForCard({ card, faces });
                const artByFaceSerial = await normalizeArtMapForPdf(rawArtByFaceSerial);

                const cellOriginX = gridOriginX + column * constants.PdfCardWidth;
                const cellOriginY = gridOriginY + row * constants.PdfCardHeight;

                document.save();
                document.translate(cellOriginX, cellOriginY);

                const surface = createPdfKitRenderSurface(
                    document,
                    constants.PdfCardWidth,
                    constants.PdfCardHeight,
                    PDF_FONT_ALIASES,
                );

                renderCardToSurface(surface, faces, {
                    ...input.renderOptions,
                    padding: input.renderOptions?.padding ?? 0,
                    artByFaceSerial: artByFaceSerial,
                });

                document.restore();
                drawCropMarksForGrid(document, input.renderOptions?.background ?? null, gridOriginX, gridOriginY, gridWidth, gridHeight, maxSheetColumns, maxSheetRows);

                cardPointer++;
            }
        }

        // Add page if needed
        if (cardPointer < input.cards.length) {
            pageCount++;

            document.addPage({
                size: constants.SpecificPageSizes[input.paperSize ?? "letter"],
                margin: 0,
            });
            fillPdfPageBackground(document, input.pageBackground ?? "#ffffff");
        }

    }

    document.end();
    return outputPromise;

}

function drawCropMarksForGrid(
    document: PdfKitDocument,
    paddingColor: string | null,
    gridOriginX: number,
    gridOriginY: number,
    gridWidth: number,
    gridHeight: number,
    columns: number,
    rows: number,
): void {
    document.save();

    const gridRight = gridOriginX + gridWidth;
    const gridBottom = gridOriginY + gridHeight;
    const cardWidth = gridWidth / columns;
    const cardHeight = gridHeight / rows;

    if (paddingColor) {
        document.fillColor(paddingColor);

        // Bands covering the gap between the card edges and where the marks start, corners included.
        document.rect(gridOriginX - CROP_MARK_GAP, gridOriginY - CROP_MARK_GAP, gridWidth + CROP_MARK_GAP * 2, CROP_MARK_GAP).fill();
        document.rect(gridOriginX - CROP_MARK_GAP, gridBottom, gridWidth + CROP_MARK_GAP * 2, CROP_MARK_GAP).fill();
        document.rect(gridOriginX - CROP_MARK_GAP, gridOriginY, CROP_MARK_GAP, gridHeight).fill();
        document.rect(gridRight, gridOriginY, CROP_MARK_GAP, gridHeight).fill();
    }

    document.strokeColor(CROP_MARK_COLOR);
    document.lineWidth(CROP_MARK_LINE_WIDTH);

    // Vertical grid-line ticks live in the top and bottom margins, clear of the card art.
    for (let column = 0; column <= columns; column++) {
        const x = gridOriginX + column * cardWidth;

        document
            .moveTo(x, gridOriginY - CROP_MARK_GAP - CROP_MARK_LENGTH)
            .lineTo(x, gridOriginY - CROP_MARK_GAP)
            .stroke();

        document
            .moveTo(x, gridBottom + CROP_MARK_GAP)
            .lineTo(x, gridBottom + CROP_MARK_GAP + CROP_MARK_LENGTH)
            .stroke();
    }

    // Horizontal grid-line ticks live in the left and right margins, clear of the card art.
    for (let row = 0; row <= rows; row++) {
        const y = gridOriginY + row * cardHeight;

        document
            .moveTo(gridOriginX - CROP_MARK_GAP - CROP_MARK_LENGTH, y)
            .lineTo(gridOriginX - CROP_MARK_GAP, y)
            .stroke();

        document
            .moveTo(gridRight + CROP_MARK_GAP, y)
            .lineTo(gridRight + CROP_MARK_GAP + CROP_MARK_LENGTH, y)
            .stroke();
    }

    document.restore();
}

type PdfFontBytes = Record<keyof PdfKitFontRegistry, Uint8Array>;

async function loadPdfFontBytes(): Promise<PdfFontBytes> {
    if (!pdfFontsPromise) {
        pdfFontsPromise = Promise.all(
            PDF_FONT_FILES.map(async ({ alias, path }) => {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`Failed to load PDF font: ${path} (HTTP ${response.status})`);
                }

                return [alias, new Uint8Array(await response.arrayBuffer())] as const;
            })
        ).then(entries => Object.fromEntries(entries) as PdfFontBytes);
    }

    return pdfFontsPromise;
}

function registerPdfFonts(document: PdfKitDocument, fontBytes: PdfFontBytes): void {
    for (const [key, alias] of Object.entries(PDF_FONT_ALIASES) as Array<[keyof PdfKitFontRegistry, string]>) {
        registerPdfKitFont(document, alias, fontBytes[key]);
    }
}

function fillPdfPageBackground(document: PdfKitDocument, color: string): void {
    document
        .save()
        .fillColor(color)
        .rect(0, 0, constants.PdfPageWidth, constants.PdfPageHeight)
        .fill()
        .restore();
}

async function normalizeArtMapForPdf(
    artByFaceSerial?: ReadonlyMap<number, RenderImageSource>
): Promise<Map<number, PdfKitImageSource> | undefined> {
    if (!artByFaceSerial || artByFaceSerial.size === 0) {
        return undefined;
    }

    const normalizedEntries = await Promise.all(
        Array.from(artByFaceSerial.entries()).map(async ([faceSerial, image]) => {
            return [faceSerial, await normalizeArtSourceForPdf(image)] as const;
        })
    );

    return new Map(normalizedEntries);
}

async function normalizeArtSourceForPdf(image: RenderImageSource): Promise<PdfKitImageSource> {
    if (typeof image === "string" || image instanceof ArrayBuffer || image instanceof Uint8Array) {
        return image;
    }

    const canvas = document.createElement("canvas");
    const width = getImageWidth(image);
    const height = getImageHeight(image);

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Unable to create a canvas context while preparing PDF artwork.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/png", 1);
    return new Uint8Array(await blob.arrayBuffer());
}

function getImageWidth(image: CanvasImageSource): number {
    if ("width" in image && typeof image.width === "number") {
        return image.width;
    }

    throw new Error("Unsupported image width for PDF export source.");
}

function getImageHeight(image: CanvasImageSource): number {
    if ("height" in image && typeof image.height === "number") {
        return image.height;
    }

    throw new Error("Unsupported image height for PDF export source.");
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("Failed to serialize artwork to a PNG for PDF export."));
                return;
            }

            resolve(blob);
        }, mimeType, quality);
    });
}