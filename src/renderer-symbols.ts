import type { Color } from "./types";
import * as constants from "./constants";
import * as utils from "./utils";

export type ManaSymbol = {
    code: string;
    fg: Color;
    bg: Color;
    label: string;
};

export type ManaCostDirection = "horizontal" | "vertical";

export type DrawManaCostOptions = {
    direction: ManaCostDirection;
    size: number;
    gap?: number;
    align?: "start" | "end";
    rotationDegrees?: number;
};

const SYMBOL_FONT_FAMILY = "Symbols, serif";
const MANA_BACK_SYMBOL = "o";
const COMPACT_NUMERIC_SCALE = 0.9;
const COMPACT_NUMERIC_TRACKING = -6;

const SYMBOL_COLORS: Record<string, { fg: Color; bg: Color }> = {
    W: { fg: constants.colors.MFW, bg: constants.colors.MBW },
    U: { fg: constants.colors.MFU, bg: constants.colors.MBU },
    B: { fg: constants.colors.MFB, bg: constants.colors.MBB },
    R: { fg: constants.colors.MFR, bg: constants.colors.MBR },
    G: { fg: constants.colors.MFG, bg: constants.colors.MBG },
    C: { fg: constants.colors.MFC, bg: constants.colors.MBC },
    T: { fg: constants.colors.MFC, bg: constants.colors.MBC },
    X: { fg: constants.colors.MFC, bg: constants.colors.MBC },
    Y: { fg: constants.colors.MFC, bg: constants.colors.MBC },
};

function getSymbolColors(code: string): { fg: Color; bg: Color } {
    return SYMBOL_COLORS[code] ?? SYMBOL_COLORS.C;
}

export function parseManaCost(manaCost: string): ManaSymbol[] {
    const tokens = manaCost.match(/\{[^}]+\}|\d{1,2}|./g) ?? [];

    return tokens
        .map(token => manaTokenToSymbol(token))
        .filter((symbol): symbol is ManaSymbol => symbol !== null);
}

export function manaTokenToSymbol(token: string): ManaSymbol | null {
    const normalized = token.replace(/[{}]/g, "").trim().toUpperCase();

    if (!normalized) {
        return null;
    }

    const colors = getSymbolColors(normalized);

    return {
        code: normalized,
        fg: colors.fg,
        bg: colors.bg,
        label: normalized,
    };
};

export function measureManaSymbol(size: number): number {
    return (constants.MCWidth * size) / 13;
};

export function drawManaSymbol(
    ctx: CanvasRenderingContext2D,
    symbol: ManaSymbol,
    x: number,
    y: number,
    size: number,
    rotationDegrees = 0
): void {
    const isCompactNumeric = /^\d{2}$/.test(symbol.code);

    ctx.save();

    ctx.font = `${size}px ${SYMBOL_FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "hanging";
    ctx.strokeStyle = "transparent";

    ctx.translate(x, y);

    if (rotationDegrees) {
        ctx.rotate((rotationDegrees * Math.PI) / -180);
    }

    ctx.fillStyle = utils.toCommaRgb(...symbol.bg);
    ctx.fillText(MANA_BACK_SYMBOL, 0, 0);

    ctx.fillStyle = utils.toCommaRgb(...symbol.fg);

    if (!isCompactNumeric) {
        ctx.fillText(symbol.code, 0, 0);
        ctx.restore();
        return;
    }

    ctx.font = `${size * COMPACT_NUMERIC_SCALE}px ${SYMBOL_FONT_FAMILY}`;

    const digits = symbol.code.split("");
    const digitWidths = digits.map(digit => ctx.measureText(digit).width);
    const tracking = COMPACT_NUMERIC_TRACKING * (size / 13);
    const compactWidth = digitWidths.reduce((total, width) => total + width, 0)
        + tracking * (digits.length - 1);
    const symbolWidth = measureManaSymbol(size);
    const compactX = (symbolWidth - compactWidth) / 2;
    const compactY = size * 0.18;

    let digitX = compactX;

    digits.forEach((digit, index) => {
        ctx.fillText(digit, digitX, compactY);
        digitX += digitWidths[index] + tracking;
    });

    ctx.restore();
};

export function drawManaCostRow(
    ctx: CanvasRenderingContext2D,
    manaCost: string,
    x: number,
    y: number,
    options: DrawManaCostOptions
): void {
    const symbols = parseManaCost(manaCost);

    if (symbols.length === 0) {
        return;
    }

    const advance = measureManaSymbol(options.size) + (options.gap ?? 0);
    const totalAdvance = symbols.length * advance;
    const axisSign = options.direction === "vertical" && options.align === "end" ? -1 : 1;
    const baseOffset = options.align === "end"
        ? (options.direction === "vertical" ? totalAdvance : -totalAdvance)
        : 0;

    symbols.forEach((symbol, index) => {
        const offset = baseOffset + index * advance * axisSign;
        const symbolX = options.direction === "horizontal" ? x + offset : x;
        const symbolY = options.direction === "vertical" ? y + offset : y;

        drawManaSymbol(
            ctx,
            symbol,
            symbolX,
            symbolY,
            options.size,
            options.rotationDegrees ?? 0
        );
    });
};