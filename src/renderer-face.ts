import * as utils from "./utils";
import type { RenderFaceContext } from "./renderer";
import {
    getFaceBounds,
    getTextBoxRect,
    getArtRect,
} from "./renderer-geometry";

export function drawFaceShell(renderCtx: RenderFaceContext): void {
    drawFrameBackground(renderCtx);
    drawTextBox(renderCtx);
    drawArtPlaceholder(renderCtx);
}

export function drawFrameBackground(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    const bounds = getFaceBounds(layout, scene.offsetX, scene.offsetY);

    ctx.fillStyle = utils.toCommaRgb(...face.faceColors.frameColor);
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.strokeStyle = "black";
    ctx.lineWidth = Math.max(1, scene.scale);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

export function drawTextBox(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    const rect = getTextBoxRect(layout, scene.offsetX, scene.offsetY);

    ctx.fillStyle = utils.toCommaRgb(...face.faceColors.tbColor);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = Math.max(1, scene.scale * 0.5);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

export function drawArtPlaceholder(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;

    if (face.faceLayout === 3) {
        return;
    }

    const rect = getArtRect(layout, scene.offsetX, scene.offsetY);
    const artPath = toArtRelativePath(face.name);

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = Math.max(1, scene.scale * 0.5);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.font = `${Math.max(10, 10 * scene.scale)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const label = ["ART", artPath].join("\n");
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const lines = label.split("\n");
    const lineHeight = 14 * scene.scale;
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

    for (let index = 0; index < lines.length; index++) {
        ctx.fillText(lines[index], centerX, startY + index * lineHeight, rect.width - 8 * scene.scale);
    }
}

export function drawNameLine(renderCtx: RenderFaceContext): void { }
export function drawManaCost(renderCtx: RenderFaceContext): void { }
export function drawTypeLine(renderCtx: RenderFaceContext): void { }
export function drawEditionBadge(renderCtx: RenderFaceContext): void { }
export function drawPowerToughness(renderCtx: RenderFaceContext): void { }
export function drawRulesText(renderCtx: RenderFaceContext): void { }

function toArtRelativePath(cardName: string): string {
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