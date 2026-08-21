import type { PrintableFace, FaceLayout } from "./types";

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

export function tokenizeRulesText(text: string): RulesToken[] {
    // todo: implement this function
    return [];
}
export function tokenizeRulesParagraphs(lines: string[]): RulesToken[][] {
    // todo: implement this function
    return [];
}
export function wrapRulesParagraph(
    ctx: CanvasRenderingContext2D,
    paragraph: RulesToken[],
    maxWidth: number,
    fontSize: number,
    symbolSize: number
): WrappedRulesLine[] {
    // todo: implement this function
    return [];
}

export function fitRulesText(
    ctx: CanvasRenderingContext2D,
    face: PrintableFace,
    layout: FaceLayout,
    scale: number
): FittedRulesLayout {
    // todo: implement this function
    return {
        fontSize: 0,
        lineHeight: 0,
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
    // todo: implement this function
    return;
}