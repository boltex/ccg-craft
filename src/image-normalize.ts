import { stripWebPMetadata } from "./stripWebPMetadata";
import type { PrintableFace } from "./types";

export const normalizedFaceArtWidth = 200;
export const normalizedFaceArtHeight = 160;

export type NormalizedFaceArt = {
    blob: Blob;
};

export type NormalizeFaceArtOptions = {
    targetWidth?: number;
    targetHeight?: number;
    mimeType?: string;
    quality?: number;
};

type CropRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export async function createSourceArtBitmap(sourceBlob: Blob): Promise<ImageBitmap> {
    if (typeof createImageBitmap !== "function") {
        throw new Error("This browser does not support createImageBitmap().");
    }

    return createImageBitmap(sourceBlob);
}

export async function normalizeFaceArtBitmap(
    sourceBitmap: ImageBitmap,
    face: PrintableFace,
    options: NormalizeFaceArtOptions = {}
): Promise<NormalizedFaceArt> {

    // --- STEP 1: DESTROY MOIRÉ AT ORIGINAL SIZE ---
    // Create an offscreen canvas matching the source dimensions
    const offCanvas = document.createElement('canvas');
    offCanvas.width = sourceBitmap.width;
    offCanvas.height = sourceBitmap.height;

    const offContext = offCanvas.getContext('2d', { alpha: false });
    if (!offContext) {
        throw new Error("Could not create a 2D context for moiré removal.");
    }
    // Apply a native blur to blend the halftone dot patterns together
    // Close to 1px is ideal for a ~550px source image
    offContext.filter = "blur(0.75px)"; //  0.75 is sufficient for moiré removal. A full pixel made the result a bit too soft.
    offContext.drawImage(sourceBitmap, 0, 0);
    // Reset filter
    offContext.filter = "none";

    // Now use the offscreen canvas as the source for further processing
    sourceBitmap = await createSourceArtBitmap(await canvasToBlob(offCanvas, "image/webp", 1.0));

    const targetWidth = options.targetWidth ?? normalizedFaceArtWidth;
    const targetHeight = options.targetHeight ?? normalizedFaceArtHeight;
    const mimeType = options.mimeType ?? "image/webp";
    const quality = options.quality ?? 1.0; // Full quality no loss by default

    const cropRect = getFaceCropRect(sourceBitmap, face);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
        throw new Error("Could not create a 2D context for art normalization.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
        sourceBitmap,
        cropRect.x,
        cropRect.y,
        cropRect.width,
        cropRect.height,
        0,
        0,
        targetWidth,
        targetHeight
    );

    const blob = await canvasToBlob(canvas, mimeType, quality); // webp with quality 1 is lossless, with better compression than PNG.

    const strippedBlob = await stripWebPMetadata(blob); // Make the imagedata even smaller by removing unnecessary metadata.

    return {
        blob: strippedBlob,
    };
}

function getFaceCropRect(sourceBitmap: ImageBitmap, face: PrintableFace): CropRect {
    if (face.faceLayout === 2) {
        return {
            x: 0,
            y: 0,
            width: Math.floor(sourceBitmap.width / 2),
            height: sourceBitmap.height,
        };
    }

    if (face.faceLayout === 4) {
        const halfWidth = Math.floor(sourceBitmap.width / 2);
        return {
            x: sourceBitmap.width - halfWidth,
            y: 0,
            width: halfWidth,
            height: sourceBitmap.height,
        };
    }

    return {
        x: 0,
        y: 0,
        width: sourceBitmap.width,
        height: sourceBitmap.height,
    };
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("Canvas normalization did not produce a blob."));
                return;
            }

            resolve(blob);
        }, mimeType, quality);
    });
}