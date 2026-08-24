import type { Color, PrintableFace, FaceLayout } from "./types";

export type TextStyle = {
    fontFamily: string;
    fontSize: number;
    fontWeight?: string | number;
    fillStyle: string;
    shadowFillStyle?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
};

export type FittedRulesLayout = any;

export function drawStyledText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: TextStyle
): void {
    // todo: implement this function
    return;
};

export function measureTextWidth(
    ctx: CanvasRenderingContext2D,
    text: string,
    style: TextStyle
): number {
    // todo: implement this function
    return 0;
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