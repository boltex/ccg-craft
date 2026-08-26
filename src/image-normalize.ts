import type { PrintableFace } from "./types";

export const normalizedFaceArtWidth = 200;
export const normalizedFaceArtHeight = 160;

export type NormalizedFaceArt = {
    blob: Blob;
    width: number;
    height: number;
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
    const targetWidth = options.targetWidth ?? normalizedFaceArtWidth;
    const targetHeight = options.targetHeight ?? normalizedFaceArtHeight;
    const mimeType = options.mimeType ?? "image/webp";
    const quality = options.quality ?? 1.0; // Full quality no loss by default

    const cropRect = getFaceCropRect(sourceBitmap, face);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
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

    const blob = await canvasToBlob(canvas, mimeType, quality);

    return {
        blob,
        width: targetWidth,
        height: targetHeight,
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