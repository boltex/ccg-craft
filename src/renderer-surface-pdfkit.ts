import type {
    FillStyle,
    RenderImageSource,
    RenderSurface,
    TextStyle,
} from "./renderer-surface";

export type PdfKitFontRegistry = {
    regularText: string;
    titleText: string;
    manaSymbols: string;
    expansionFront: string;
    expansionBack: string;
};

export type PdfKitImageSource = ArrayBuffer | Uint8Array | string;

export type PdfKitGradient = {
    stop(offset: number, color: string, opacity?: number): PdfKitGradient;
    apply(): void;
};

export type PdfKitDocument = {
    rect(x: number, y: number, width: number, height: number): PdfKitDocument;
    fill(): PdfKitDocument;
    stroke(): PdfKitDocument;
    save(): PdfKitDocument;
    restore(): PdfKitDocument;
    translate(x: number, y: number): PdfKitDocument;
    rotate(angle: number, options?: { origin: [number, number] }): PdfKitDocument;
    moveTo(x: number, y: number): PdfKitDocument;
    lineTo(x: number, y: number): PdfKitDocument;
    closePath(): PdfKitDocument;
    image(
        src: PdfKitImageSource,
        x: number,
        y: number,
        options?: { width?: number; height?: number }
    ): PdfKitDocument;
    fillColor(color: string, opacity?: number): PdfKitDocument;
    strokeColor(color: string, opacity?: number): PdfKitDocument;
    lineWidth(width: number): PdfKitDocument;
    font(src: string): PdfKitDocument;
    fontSize(size: number): PdfKitDocument;
    text(
        text: string,
        x: number,
        y: number,
        options?: { lineBreak?: boolean; width?: number; align?: "left" | "center" | "right" }
    ): PdfKitDocument;
    widthOfString(text: string): number;
    linearGradient(x0: number, y0: number, x1: number, y1: number): PdfKitGradient;
    registerFont(alias: string, src: PdfKitImageSource): PdfKitDocument;
};

type PdfKitGradientHandle = {
    kind: "pdfkit-gradient";
    value: PdfKitGradient;
};

type PdfKitFill = string | PdfKitGradientHandle;

// Fallback-only PDF standard fonts. These are built into PDF readers rather than
// being looked up from the operating system, so they avoid OS-level font-missing errors.
const FALLBACK_PDF_FONT_REGISTRY: PdfKitFontRegistry = {
    regularText: "Times-Roman",
    titleText: "Times-Bold",
    manaSymbols: "Symbol",
    expansionFront: "Helvetica",
    expansionBack: "Helvetica-Bold",
};

const PDFKIT_IMAGE_TYPES = new Set(["string", "object"]);

export function createPdfKitRenderSurface(
    document: PdfKitDocument,
    width: number,
    height: number,
    fonts: Partial<PdfKitFontRegistry> = {}
): RenderSurface {
    const fontRegistry = {
        ...FALLBACK_PDF_FONT_REGISTRY,
        ...fonts,
    };

    let currentFill: PdfKitFill = "black";

    function applyTextStyle(style: TextStyle): void {
        document.font(resolvePdfKitFontName(style.fontFamily, fontRegistry));
        document.fontSize(style.fontSize);
        applyFillColor(document, style.fillStyle);
    }

    function applyCurrentFill(): void {
        if (typeof currentFill === "string") {
            applyFillColor(document, currentFill);
            return;
        }

        currentFill.value.apply();
    }

    return {
        width,
        height,
        clearRect() {
            // PDF pages start empty, so clearing is a no-op for this surface.
        },
        fillRect(x, y, rectWidth, rectHeight) {
            applyCurrentFill();
            document.rect(x, y, rectWidth, rectHeight).fill();
        },
        strokeRect(x, y, rectWidth, rectHeight) {
            document.rect(x, y, rectWidth, rectHeight).stroke();
        },
        save() {
            document.save();
        },
        restore() {
            document.restore();
        },
        translate(x, y) {
            document.translate(x, y);
        },
        rotate(radians) {
            document.rotate((radians * 180) / Math.PI, { origin: [0, 0] });
        },
        beginPath() {
            // PDFKit path commands begin implicitly from the first moveTo/lineTo.
        },
        moveTo(x, y) {
            document.moveTo(x, y);
        },
        lineTo(x, y) {
            document.lineTo(x, y);
        },
        closePath() {
            document.closePath();
        },
        fill() {
            applyCurrentFill();
            document.fill();
        },
        drawImage(image, x, y, imageWidth, imageHeight) {
            if (!isPdfKitImageSource(image)) {
                throw new Error("Unsupported PDF image source for PDFKit surface.");
            }

            document.image(image, x, y, {
                width: imageWidth,
                height: imageHeight,
            });
        },
        setFillStyle(fillStyle) {
            currentFill = toPdfKitFill(document, fillStyle);
        },
        setStrokeStyle(strokeStyle) {
            applyStrokeColor(document, strokeStyle);
        },
        setLineWidth(lineWidth) {
            document.lineWidth(lineWidth);
        },
        applyTextStyle(style) {
            applyTextStyle(style);
        },
        fillText(text, x, y, maxWidth) {
            document.text(text, x, y, {
                lineBreak: false,
                width: maxWidth,
            });
        },
        drawText(text, x, y, style) {
            document.save();
            applyTextStyle(style);
            document.translate(x, y);

            if (style.rotationDegrees) {
                document.rotate(-style.rotationDegrees, { origin: [0, 0] });
            }

            if (shouldDrawTextShadow(style)) {
                document.save();
                applyTextStyle({
                    ...style,
                    fillStyle: style.shadowColor ?? style.fillStyle,
                    shadowColor: undefined,
                    shadowOffsetX: undefined,
                    shadowOffsetY: undefined,
                });
                document.text(text, style.shadowOffsetX ?? 0, style.shadowOffsetY ?? 0, {
                    lineBreak: false,
                    width: style.maxWidth,
                    align: toPdfKitTextAlign(style.textAlign),
                });
                document.restore();
                applyTextStyle(style);
            }

            document.text(text, 0, 0, {
                lineBreak: false,
                width: style.maxWidth,
                align: toPdfKitTextAlign(style.textAlign),
            });
            document.restore();
        },
        measureText(text, style) {
            applyTextStyle(style);
            return document.widthOfString(text);
        },
    };
}

export function registerPdfKitFont(
    document: PdfKitDocument,
    alias: string,
    fontData: PdfKitImageSource
): void {
    document.registerFont(alias, fontData);
}

function toPdfKitFill(document: PdfKitDocument, fillStyle: FillStyle): PdfKitFill {
    if (typeof fillStyle === "string") {
        return fillStyle;
    }

    const gradient = document.linearGradient(
        fillStyle.x0,
        fillStyle.y0,
        fillStyle.x1,
        fillStyle.y1
    );

    fillStyle.stops.forEach(stop => {
        const normalized = normalizePdfKitColor(stop.color);
        gradient.stop(stop.offset, normalized.color, normalized.opacity);
    });

    return {
        kind: "pdfkit-gradient",
        value: gradient,
    };
}

function resolvePdfKitFontName(fontFamily: string, fonts: PdfKitFontRegistry): string {
    const family = fontFamily.split(",")[0]?.trim().replaceAll(/['"]/g, "") ?? "";

    switch (family) {
        case "Medieval":
            return fonts.titleText;
        case "Plantin":
            return fonts.regularText;
        case "Symbols":
            return fonts.manaSymbols;
        case "ExpFront":
            return fonts.expansionFront;
        case "ExpBack":
            return fonts.expansionBack;
        default:
            return fonts.regularText;
    }
}

function toPdfKitTextAlign(textAlign: TextStyle["textAlign"]): "left" | "center" | "right" {
    switch (textAlign) {
        case "center":
        case "right":
        case "left":
            return textAlign;
        case "end":
            return "right";
        case "start":
        default:
            return "left";
    }
}

function isPdfKitImageSource(image: RenderImageSource): image is PdfKitImageSource {
    return typeof image === "string"
        || image instanceof ArrayBuffer
        || image instanceof Uint8Array;
}

function shouldDrawTextShadow(style: TextStyle): boolean {
    const shadowColor = style.shadowColor?.trim();

    if (!shadowColor || shadowColor === "transparent") {
        return false;
    }

    return (style.shadowOffsetX ?? 0) !== 0 || (style.shadowOffsetY ?? 0) !== 0;
}

function applyFillColor(document: PdfKitDocument, color: string): void {
    const normalized = normalizePdfKitColor(color);
    document.fillColor(normalized.color, normalized.opacity);
}

function applyStrokeColor(document: PdfKitDocument, color: string): void {
    const normalized = normalizePdfKitColor(color);
    document.strokeColor(normalized.color, normalized.opacity);
}

function normalizePdfKitColor(color: string): { color: string; opacity?: number } {
    const normalized = color.trim();
    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);

    if (!rgbMatch) {
        return { color: normalized };
    }

    const channels = rgbMatch[1].split(",").map(part => part.trim());
    const [rawR, rawG, rawB, rawAlpha] = channels;

    if (!rawR || !rawG || !rawB) {
        return { color: normalized };
    }

    const r = clampColorChannel(Number.parseFloat(rawR));
    const g = clampColorChannel(Number.parseFloat(rawG));
    const b = clampColorChannel(Number.parseFloat(rawB));
    const opacity = rawAlpha === undefined ? undefined : clampOpacity(Number.parseFloat(rawAlpha));

    return {
        color: `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`,
        opacity,
    };
}

function clampColorChannel(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(255, Math.round(value)));
}

function clampOpacity(value: number): number | undefined {
    if (!Number.isFinite(value)) {
        return undefined;
    }

    return Math.max(0, Math.min(1, value));
}

function toHexByte(value: number): string {
    return value.toString(16).padStart(2, "0");
}