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
import type { PrintableFace } from "./types";

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

export async function generateSingleCardPdf(input: GenerateSingleCardPdfInput): Promise<Blob> {
    const PdfDocument = PDFDocument as unknown as PdfKitDocumentConstructor;
    const document = new PdfDocument({
        autoFirstPage: false,
        margin: 0,
        compress: true,
        font: null,
    });

    const outputPromise = toBlob(document);

    document.addPage({
        size: [constants.PdfPageWidth, constants.PdfPageHeight],
        margin: 0,
    });

    fillPdfPageBackground(document, input.pageBackground ?? "#ffffff");

    const fontBytes = await loadPdfFontBytes();
    registerPdfFonts(document, fontBytes);

    const pdfArt = await normalizeArtMapForPdf(input.artByFaceSerial);
    const cardOriginX = (constants.PdfPageWidth - constants.PdfCardWidth) / 2;
    const cardOriginY = (constants.PdfPageHeight - constants.PdfCardHeight) / 2;

    document.save();
    document.translate(cardOriginX, cardOriginY);

    const surface = createPdfKitRenderSurface(
        document,
        constants.PdfCardWidth,
        constants.PdfCardHeight,
        PDF_FONT_ALIASES,
    );

    renderCardToSurface(surface, input.faces, {
        ...input.renderOptions,
        padding: input.renderOptions?.padding ?? 0,
        artByFaceSerial: pdfArt,
    });

    document.restore();
    document.end();

    return outputPromise;
}

const SHEET_COLUMNS = 3;
const SHEET_ROWS = 3;
const CROP_MARK_GAP = 4;
const CROP_MARK_LENGTH = 10;
const CROP_MARK_LINE_WIDTH = 0.5;
const CROP_MARK_COLOR = "#000000";

export async function generateCardSheetPdf(input: GenerateSingleCardPdfInput): Promise<Blob> {
    const PdfDocument = PDFDocument as unknown as PdfKitDocumentConstructor;
    const document = new PdfDocument({
        autoFirstPage: false,
        margin: 0,
        compress: true,
        font: null,
    });

    const outputPromise = toBlob(document);

    document.addPage({
        size: [constants.PdfPageWidth, constants.PdfPageHeight],
        margin: 0,
    });

    fillPdfPageBackground(document, input.pageBackground ?? "#ffffff");

    const fontBytes = await loadPdfFontBytes();
    registerPdfFonts(document, fontBytes);

    const pdfArt = await normalizeArtMapForPdf(input.artByFaceSerial);

    const gridWidth = constants.PdfCardWidth * SHEET_COLUMNS;
    const gridHeight = constants.PdfCardHeight * SHEET_ROWS;
    const gridOriginX = (constants.PdfPageWidth - gridWidth) / 2;
    const gridOriginY = (constants.PdfPageHeight - gridHeight) / 2;

    for (let row = 0; row < SHEET_ROWS; row++) {
        for (let column = 0; column < SHEET_COLUMNS; column++) {
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

            renderCardToSurface(surface, input.faces, {
                ...input.renderOptions,
                padding: input.renderOptions?.padding ?? 0,
                artByFaceSerial: pdfArt,
            });

            document.restore();
        }
    }

    drawCropMarksForGrid(document, input.renderOptions?.background ?? null, gridOriginX, gridOriginY, gridWidth, gridHeight, SHEET_COLUMNS, SHEET_ROWS);



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