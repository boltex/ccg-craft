import { FaceLayout } from "./types";

// Creates "rgb(r, g, b)" or "rgba(r, g, b, a)"
export function toCommaRgb(r: number, g: number, b: number, alpha: number | null = null) {
    if (alpha === null) {
        return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function scaleFaceLayout(layout: FaceLayout, scale: number): FaceLayout {
    return {
        xback: layout.xback * scale,
        yback: layout.yback * scale,
        xbwidth: layout.xbwidth * scale,
        ybheight: layout.ybheight * scale,
        xname: layout.xname * scale,
        yname: layout.yname * scale,
        xmana: layout.xmana * scale,
        ymana: layout.ymana * scale,
        xtypeline: layout.xtypeline * scale,
        ytypeline: layout.ytypeline * scale,
        xedition: layout.xedition * scale,
        yedition: layout.yedition * scale,
        xpowertough: layout.xpowertough * scale,
        ypowertough: layout.ypowertough * scale,
        xtext: layout.xtext * scale,
        ytext: layout.ytext * scale,
        textangle: layout.textangle,
        xtb: layout.xtb * scale,
        ytb: layout.ytb * scale,
        tbwidth: layout.tbwidth * scale,
        tbheight: layout.tbheight * scale,
        xart: layout.xart * scale,
        yart: layout.yart * scale,
        artwidth: layout.artwidth * scale,
        artheight: layout.artheight * scale,
    };
}

export function scaleTextSizeLimits(limits: [number, number][], scale: number): [number, number][] {
    return limits.map(([min, max]) => [min * scale, max * scale]);
}

export function scaleLineHeights(heights: number[], scale: number): number[] {
    return heights.map(height => height * scale);
}

export function clearCanvas(canvas: HTMLCanvasElement | null) {
    if (canvas) {
        const context = canvas.getContext("2d");
        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}

export function toArtRelativePath(cardName: string): string {
    let slug = cardName.toLowerCase();
    slug = slug.replaceAll("-", "_");
    slug = slug.replaceAll(" ", "_");
    slug = slug.replaceAll("'", "");
    slug = slug.replaceAll(",", "");
    slug = slug.replaceAll(":", "");
    slug = slug.replaceAll("!", "");

    const first = slug[0] ?? "x";
    const prefix = ["x", "y", "z"].includes(first) ? "xyz" : `${first}${first}`;

    return `${prefix}/${slug}.bmp`;
}