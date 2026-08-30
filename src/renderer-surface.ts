export type TextStyle = {
    fontFamily: string;
    fontSize: number;
    fontWeight?: string | number;
    fillStyle: string;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
    strokeStyle?: string;
    rotationDegrees?: number;
    maxWidth?: number;
};

export type GradientStop = {
    offset: number;
    color: string;
};

export type LinearGradientFill = {
    kind: "linear-gradient";
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    stops: GradientStop[];
};

export type FillStyle = string | LinearGradientFill;
export type RenderImageSource = CanvasImageSource | ArrayBuffer | Uint8Array | string;

export type RenderSurfaceSize = {
    width: number;
    height: number;
};

export interface RenderSurface {
    readonly width: number;
    readonly height: number;
    clearRect(x: number, y: number, width: number, height: number): void;
    fillRect(x: number, y: number, width: number, height: number): void;
    strokeRect(x: number, y: number, width: number, height: number): void;
    save(): void;
    restore(): void;
    translate(x: number, y: number): void;
    rotate(radians: number): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
    fill(): void;
    drawImage(image: RenderImageSource, x: number, y: number, width: number, height: number): void;
    setFillStyle(fillStyle: FillStyle): void;
    setStrokeStyle(strokeStyle: string): void;
    setLineWidth(width: number): void;
    applyTextStyle(style: TextStyle): void;
    fillText(text: string, x: number, y: number, maxWidth?: number): void;
    drawText(text: string, x: number, y: number, style: TextStyle): void;
    measureText(text: string, style: TextStyle): number;
}

export function createCanvasRenderSurface(ctx: CanvasRenderingContext2D): RenderSurface {
    const canvas = ctx.canvas as HTMLCanvasElement;

    function assertCanvasImageSource(image: RenderImageSource): CanvasImageSource {
        if (typeof image === "string" || image instanceof ArrayBuffer || image instanceof Uint8Array) {
            throw new Error("Canvas render surface requires a canvas-compatible image source.");
        }

        return image;
    }

    function applyCanvasTextStyle(style: TextStyle): void {
        const weight = style.fontWeight ? `${style.fontWeight} ` : "";
        ctx.font = `${weight}${style.fontSize}px ${style.fontFamily}`;
        ctx.fillStyle = style.fillStyle;
        ctx.textAlign = style.textAlign ?? "left";
        ctx.textBaseline = style.textBaseline ?? "hanging";
        ctx.strokeStyle = style.strokeStyle ?? "transparent";
        ctx.shadowColor = style.shadowColor ?? "transparent";
        ctx.shadowOffsetX = style.shadowOffsetX ?? 0;
        ctx.shadowOffsetY = style.shadowOffsetY ?? 0;
    }

    return {
        width: canvas.width,
        height: canvas.height,
        clearRect(x, y, width, height) {
            ctx.clearRect(x, y, width, height);
        },
        fillRect(x, y, width, height) {
            ctx.fillRect(x, y, width, height);
        },
        strokeRect(x, y, width, height) {
            ctx.strokeRect(x, y, width, height);
        },
        save() {
            ctx.save();
        },
        restore() {
            ctx.restore();
        },
        translate(x, y) {
            ctx.translate(x, y);
        },
        rotate(radians) {
            ctx.rotate(radians);
        },
        beginPath() {
            ctx.beginPath();
        },
        moveTo(x, y) {
            ctx.moveTo(x, y);
        },
        lineTo(x, y) {
            ctx.lineTo(x, y);
        },
        closePath() {
            ctx.closePath();
        },
        fill() {
            ctx.fill();
        },
        drawImage(image, x, y, width, height) {
            ctx.drawImage(assertCanvasImageSource(image), x, y, width, height);
        },
        setFillStyle(fillStyle) {
            if (typeof fillStyle === "string") {
                ctx.fillStyle = fillStyle;
                return;
            }

            const gradient = ctx.createLinearGradient(
                fillStyle.x0,
                fillStyle.y0,
                fillStyle.x1,
                fillStyle.y1
            );

            fillStyle.stops.forEach(stop => {
                gradient.addColorStop(stop.offset, stop.color);
            });

            ctx.fillStyle = gradient;
        },
        setStrokeStyle(strokeStyle) {
            ctx.strokeStyle = strokeStyle;
        },
        setLineWidth(width) {
            ctx.lineWidth = width;
        },
        applyTextStyle(style) {
            applyCanvasTextStyle(style);
        },
        fillText(text, x, y, maxWidth) {
            if (maxWidth) {
                ctx.fillText(text, x, y, maxWidth);
                return;
            }

            ctx.fillText(text, x, y);
        },
        drawText(text, x, y, style) {
            ctx.save();
            applyCanvasTextStyle(style);

            ctx.translate(x, y);

            if (style.rotationDegrees) {
                ctx.rotate((style.rotationDegrees * Math.PI) / -180);
            }

            this.fillText(text, 0, 0, style.maxWidth);

            ctx.restore();
        },
        measureText(text, style) {
            ctx.save();
            applyCanvasTextStyle(style);
            const width = ctx.measureText(text).width;

            ctx.restore();
            return width;
        },
    };
}