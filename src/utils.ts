// Creates "rgb(r, g, b)" or "rgba(r, g, b, a)"
export function toCommaRgb(r: number, g: number, b: number, alpha: number | null = null) {
    if (alpha === null) {
        return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}