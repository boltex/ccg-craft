import type { RenderSurface, TextStyle } from "./renderer-surface";

export type { TextStyle } from "./renderer-surface";

export function drawStyledText(
    surface: RenderSurface,
    text: string,
    x: number,
    y: number,
    style: TextStyle
): void {
    surface.drawText(text, x, y, style);
}

export function measureTextWidth(
    surface: RenderSurface,
    text: string,
    style: TextStyle
): number {
    return surface.measureText(text, style);
}
