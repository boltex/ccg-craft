import type { Color, FaceLayout } from "./types";

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

export function darkenColor(color: Color, factor: number): Color {
    const amount = Math.min(Math.max(factor, 0), 1);

    if (amount === 0) {
        return [...color] as Color;
    }

    if (amount === 1) {
        return [0, 0, 0];
    }

    const [l, c, h] = rgbToOklch(color);
    const remaining = 1 - amount;

    return oklchToRgb(
        l * remaining,
        c * Math.sqrt(remaining),
        h,
    );
}

export function lightenColor(color: Color, factor: number): Color {
    const amount = Math.min(Math.max(factor, 0), 1);

    if (amount === 0) {
        return [...color] as Color;
    }

    if (amount === 1) {
        return [255, 255, 255];
    }

    const [l, c, h] = rgbToOklch(color);
    const remaining = 1 - amount;

    return oklchToRgb(
        l + (1 - l) * amount,
        c * Math.sqrt(remaining),
        h,
    );
}

function rgbToOklch([r, g, b]: Color): [number, number, number] {
    const [okl, oka, okb] = rgbToOklab(r, g, b);
    return [okl, Math.hypot(oka, okb), Math.atan2(okb, oka)];
}

function oklchToRgb(lightness: number, chroma: number, hue: number): Color {
    const a = chroma * Math.cos(hue);
    const b = chroma * Math.sin(hue);

    return oklabToRgb(lightness, a, b);
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
    const linearR = srgbToLinear(r / 255);
    const linearG = srgbToLinear(g / 255);
    const linearB = srgbToLinear(b / 255);

    const l = Math.cbrt(0.4122214708 * linearR + 0.5363325363 * linearG + 0.0514459929 * linearB);
    const m = Math.cbrt(0.2119034982 * linearR + 0.6806995451 * linearG + 0.1073969566 * linearB);
    const s = Math.cbrt(0.0883024619 * linearR + 0.2817188376 * linearG + 0.6299787005 * linearB);

    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

function oklabToRgb(lightness: number, a: number, b: number): Color {
    const l = lightness + 0.3963377774 * a + 0.2158037573 * b;
    const m = lightness - 0.1055613458 * a - 0.0638541728 * b;
    const s = lightness - 0.0894841775 * a - 1.291485548 * b;

    const linearR = 4.0767416621 * l ** 3 - 3.3077115913 * m ** 3 + 0.2309699292 * s ** 3;
    const linearG = -1.2684380046 * l ** 3 + 2.6097574011 * m ** 3 - 0.3413193965 * s ** 3;
    const linearB = -0.0041960863 * l ** 3 - 0.7034186147 * m ** 3 + 1.707614701 * s ** 3;

    return [
        toRgbChannel(linearToSrgb(linearR) * 255),
        toRgbChannel(linearToSrgb(linearG) * 255),
        toRgbChannel(linearToSrgb(linearB) * 255),
    ];
}

function srgbToLinear(channel: number): number {
    if (channel <= 0.04045) {
        return channel / 12.92;
    }
    return ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
    const clamped = Math.min(Math.max(channel, 0), 1);
    if (clamped <= 0.0031308) {
        return 12.92 * clamped;
    }
    return 1.055 * (clamped ** (1 / 2.4)) - 0.055;
}

function toRgbChannel(channel: number): number {
    return Math.round(Math.min(Math.max(channel, 0), 255));
}
