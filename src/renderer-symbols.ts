import type { Color } from "./types";

export type ManaSymbol = {
    code: string;
    fg: Color;
    bg: Color;
    label: string;
};

export function parseManaCost(manaCost: string): ManaSymbol[] {
    // todo: implement this function
    return [];
}
export function manaTokenToSymbol(token: string): ManaSymbol | null {
    // todo: implement this function
    return null;
};

export function measureManaSymbol(size: number): number {
    // todo: implement this function
    return 0;
};

export function drawManaSymbol(
    ctx: CanvasRenderingContext2D,
    symbol: ManaSymbol,
    x: number,
    y: number,
    size: number
): void {
    // todo: implement this function
    return;
};

export function drawManaCostRow(
    ctx: CanvasRenderingContext2D,
    manaCost: string,
    x: number,
    y: number,
    direction: "horizontal" | "vertical",
    size: number,
    gap: number
): void {
    // todo: implement this function
    return;
};