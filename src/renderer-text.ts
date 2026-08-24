import type { PrintableFace, FaceLayout } from "./types";

export type TextStyle = {
    fontFamily: string;
    fontSize: number;
    fontWeight?: string | number;
    fillStyle: string;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
    strokeStyle?: string;
    rotationDegrees?: number;
    maxWidth?: number;
};

export type FittedRulesLayout = any;

export function drawStyledText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: TextStyle
): void {
    ctx.save();

    const weight = style.fontWeight ? `${style.fontWeight} ` : "";
    ctx.font = `${weight}${style.fontSize}px ${style.fontFamily}`;
    ctx.fillStyle = style.fillStyle;
    ctx.textAlign = style.textAlign ?? "left";
    ctx.textBaseline = style.textBaseline ?? "top";
    ctx.strokeStyle = style.strokeStyle ?? "transparent";
    ctx.shadowColor = style.shadowColor ?? "transparent";
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0;
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0;
    ctx.shadowBlur = style.shadowBlur ?? 0;

    ctx.translate(x, y);

    if (style.rotationDegrees) {
        ctx.rotate((style.rotationDegrees * Math.PI) / -180);
    }

    if (style.maxWidth) {
        ctx.fillText(text, 0, 0, style.maxWidth);
    } else {
        ctx.fillText(text, 0, 0);
    }

    ctx.restore();
};

export function measureTextWidth(
    ctx: CanvasRenderingContext2D,
    text: string,
    style: TextStyle
): number {
    ctx.save();

    const weight = style.fontWeight ? `${style.fontWeight} ` : "";
    ctx.font = `${weight}${style.fontSize}px ${style.fontFamily}`;
    const width = ctx.measureText(text).width;

    ctx.restore();
    return width;
}

export function pickRulesFontSize(
    ctx: CanvasRenderingContext2D,
    face: PrintableFace,
    layout: FaceLayout,
    scale: number
): FittedRulesLayout {
    // todo: implement this function
    return { /* fill in with appropriate default values */ };
}