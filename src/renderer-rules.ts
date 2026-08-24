import * as constants from "./constants";
import type { PrintableFace, FaceLayout } from "./types";
import { drawManaSymbol, manaTokenToSymbol, measureManaSymbol } from "./renderer-symbols";

export type RulesToken =
    | { kind: "text"; value: string }
    | { kind: "mana"; value: string };

export type WrappedRulesLine = {
    tokens: RulesToken[];
    width: number;
};

export type FittedRulesLayout = {
    fontSize: number;
    lineHeight: number;
    lines: WrappedRulesLine[];
    xAdjust: number;
    yAdjust: number;
};

type RulesUnit = {
    tokens: RulesToken[];
    width: number;
};

const RULES_FONT_FAMILY = "Plantin, serif";
const MIN_RULES_FONT_SIZE = 6;
const MAX_RULES_FONT_SIZE = 11;

function getRulesFont(ctx: CanvasRenderingContext2D, fontSize: number): void {
    ctx.font = `${fontSize}px ${RULES_FONT_FAMILY}`;
}

function measureRulesText(ctx: CanvasRenderingContext2D, text: string, fontSize: number): number {
    if (!text) {
        return 0;
    }

    ctx.save();
    getRulesFont(ctx, fontSize);
    const width = ctx.measureText(text).width;
    ctx.restore();

    return width;
}

function measureRulesToken(
    ctx: CanvasRenderingContext2D,
    token: RulesToken,
    fontSize: number,
    symbolSize: number
): number {
    if (token.kind === "mana") {
        return measureManaSymbol(symbolSize);
    }

    return measureRulesText(ctx, token.value, fontSize);
}

function measureRulesLine(
    ctx: CanvasRenderingContext2D,
    tokens: RulesToken[],
    fontSize: number,
    symbolSize: number
): number {
    return tokens.reduce((total, token) => (
        total + measureRulesToken(ctx, token, fontSize, symbolSize)
    ), 0);
}

function splitParagraphIntoUnits(
    ctx: CanvasRenderingContext2D,
    paragraph: RulesToken[],
    fontSize: number,
    symbolSize: number
): RulesUnit[] {
    const units: RulesUnit[] = [];
    let currentUnit: RulesToken[] = [];

    const pushCurrentUnit = (): void => {
        if (currentUnit.length === 0) {
            return;
        }

        units.push({
            tokens: currentUnit,
            width: measureRulesLine(ctx, currentUnit, fontSize, symbolSize),
        });
        currentUnit = [];
    };

    for (const token of paragraph) {
        if (token.kind === "mana") {
            currentUnit.push(token);
            continue;
        }

        const parts = token.value.match(/\s+|\S+/g) ?? [];

        for (const part of parts) {
            if (/^\s+$/.test(part)) {
                pushCurrentUnit();
                continue;
            }

            currentUnit.push({ kind: "text", value: part });
        }
    }

    pushCurrentUnit();
    return units;
}

function getScaledRuleLimits(faceLayout: number, scale: number): { width: number; height: number } {
    const [rawWidth, rawHeight] = constants.TextSizeLimits[faceLayout]
        ?? [constants.TextSizeLimits[0][0], constants.TextSizeLimits[0][1]];

    return {
        width: rawWidth * scale,
        height: rawHeight * scale,
    };
}

function getLineHeightForFontSize(fontSize: number, scale: number): number {
    const clampedSize = Math.max(MIN_RULES_FONT_SIZE, Math.min(MAX_RULES_FONT_SIZE, fontSize));
    const lineHeight = constants.LineHeights[MAX_RULES_FONT_SIZE - clampedSize]
        ?? constants.LineHeights[constants.LineHeights.length - 1];

    return lineHeight * scale;
}

function getCandidateFontSizes(faceLayout: number): number[] {
    const maxSize = faceLayout === 1 || faceLayout === 3 ? 10 : MAX_RULES_FONT_SIZE;
    const sizes: number[] = [];

    for (let fontSize = maxSize; fontSize >= MIN_RULES_FONT_SIZE; fontSize--) {
        sizes.push(fontSize);
    }

    return sizes;
}

function buildWrappedLines(
    ctx: CanvasRenderingContext2D,
    paragraphs: RulesToken[][],
    maxWidth: number,
    fontSize: number,
    symbolSize: number
): WrappedRulesLine[] {
    const lines: WrappedRulesLine[] = [];

    for (const paragraph of paragraphs) {
        const wrappedParagraph = wrapRulesParagraph(ctx, paragraph, maxWidth, fontSize, symbolSize);

        if (wrappedParagraph.length > 0) {
            lines.push(...wrappedParagraph);
        }
    }

    return lines;
}

export function tokenizeRulesText(text: string): RulesToken[] {
    const tokens: RulesToken[] = [];
    const manaPattern = /\{[^}]+\}/g;
    let cursor = 0;

    for (const match of text.matchAll(manaPattern)) {
        const start = match.index ?? 0;

        if (start > cursor) {
            tokens.push({ kind: "text", value: text.slice(cursor, start) });
        }

        tokens.push({ kind: "mana", value: match[0] });
        cursor = start + match[0].length;
    }

    if (cursor < text.length) {
        tokens.push({ kind: "text", value: text.slice(cursor) });
    }

    return tokens;
}
export function tokenizeRulesParagraphs(lines: string[]): RulesToken[][] {
    return lines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(tokenizeRulesText);
}
export function wrapRulesParagraph(
    ctx: CanvasRenderingContext2D,
    paragraph: RulesToken[],
    maxWidth: number,
    fontSize: number,
    symbolSize: number
): WrappedRulesLine[] {
    const units = splitParagraphIntoUnits(ctx, paragraph, fontSize, symbolSize);
    const spaceToken: RulesToken = { kind: "text", value: " " };
    const spaceWidth = measureRulesText(ctx, " ", fontSize);
    const lines: WrappedRulesLine[] = [];
    let currentTokens: RulesToken[] = [];
    let currentWidth = 0;

    const pushCurrentLine = (): void => {
        if (currentTokens.length === 0) {
            return;
        }

        lines.push({
            tokens: currentTokens,
            width: currentWidth,
        });
        currentTokens = [];
        currentWidth = 0;
    };

    for (const unit of units) {
        const separatorWidth = currentTokens.length > 0 ? spaceWidth : 0;
        const nextWidth = currentWidth + separatorWidth + unit.width;

        if (currentTokens.length > 0 && nextWidth > maxWidth) {
            pushCurrentLine();
        }

        if (currentTokens.length > 0) {
            currentTokens.push(spaceToken);
            currentWidth += spaceWidth;
        }

        currentTokens.push(...unit.tokens);
        currentWidth += unit.width;
    }

    pushCurrentLine();
    return lines;
}

export function fitRulesText(
    ctx: CanvasRenderingContext2D,
    face: PrintableFace,
    layout: FaceLayout,
    scale: number
): FittedRulesLayout {
    const paragraphs = tokenizeRulesParagraphs(face.textLines);

    if (paragraphs.length === 0) {
        return {
            fontSize: 0,
            lineHeight: 0,
            lines: [],
            xAdjust: 0,
            yAdjust: 0,
        };
    }

    const limits = getScaledRuleLimits(face.faceLayout, scale);
    const candidateSizes = getCandidateFontSizes(face.faceLayout);
    const defaultFontSize = candidateSizes[candidateSizes.length - 1] * scale;
    const defaultLineHeight = getLineHeightForFontSize(candidateSizes[candidateSizes.length - 1], scale);
    let fallbackLayout: FittedRulesLayout | null = null;

    for (const size of candidateSizes) {
        const scaledFontSize = size * scale;
        const symbolSize = scaledFontSize;
        const lineHeight = getLineHeightForFontSize(size, scale);
        const lines = buildWrappedLines(ctx, paragraphs, limits.width, scaledFontSize, symbolSize);
        const usedHeight = lines.length * lineHeight;
        const usedWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0);

        const candidateLayout: FittedRulesLayout = {
            fontSize: scaledFontSize,
            lineHeight,
            lines,
            xAdjust: 0,
            yAdjust: 0,
        };

        if (!fallbackLayout) {
            fallbackLayout = candidateLayout;
        }

        if (usedWidth <= limits.width && usedHeight <= limits.height) {
            const shouldCenter = size === candidateSizes[0];

            return {
                ...candidateLayout,
                xAdjust: shouldCenter ? Math.max(0, (limits.width - usedWidth) / 2) : 0,
                yAdjust: shouldCenter ? Math.max(0, (limits.height - usedHeight) / 2) : 0,
            };
        }
    }

    if (fallbackLayout) {
        return fallbackLayout;
    }

    return {
        fontSize: defaultFontSize,
        lineHeight: defaultLineHeight,
        lines: [],
        xAdjust: 0,
        yAdjust: 0
    };
}

export function drawWrappedRulesText(
    ctx: CanvasRenderingContext2D,
    layout: FittedRulesLayout,
    faceLayout: FaceLayout,
    originX: number,
    originY: number
): void {
    if (layout.lines.length === 0 || layout.fontSize <= 0) {
        return;
    }

    ctx.save();
    ctx.translate(originX + faceLayout.xtext + layout.xAdjust, originY + faceLayout.ytext + layout.yAdjust);

    if (faceLayout.textangle) {
        ctx.rotate((faceLayout.textangle * Math.PI) / -180);
    }

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "hanging";
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "transparent";
    getRulesFont(ctx, layout.fontSize);

    layout.lines.forEach((line, lineIndex) => {
        let cursorX = 0;
        const cursorY = lineIndex * layout.lineHeight;

        for (const token of line.tokens) {
            if (token.kind === "mana") {
                const symbol = manaTokenToSymbol(token.value);

                if (symbol) {
                    drawManaSymbol(ctx, symbol, cursorX, cursorY, layout.fontSize, 0);
                    cursorX += measureManaSymbol(layout.fontSize);
                }

                continue;
            }

            if (token.value.length > 0) {
                ctx.fillText(token.value, cursorX, cursorY);
                cursorX += measureRulesText(ctx, token.value, layout.fontSize);
            }
        }
    });

    ctx.restore();
}