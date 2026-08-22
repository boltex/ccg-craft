import * as utils from "./utils";
import { getLandTextBoxFill, getDefaultTextBoxFill } from "./frame-colors";
import type { RenderFaceContext } from "./renderer";
import {
    getFaceBounds,
    getTextBoxRect,
    getArtRect,
} from "./renderer-geometry";

export function renderFace(renderCtx: RenderFaceContext): void {

    const { ctx, face, layout, scene } = renderCtx;

    // faceLayout 3 is the bottom flip side of a 180 degree flip card, so we don't draw the frame
    //  background, manacost or art for that face which is already drawn on the top face.
    if (face.faceLayout !== 3) {
        // back
        drawFrameBackground(renderCtx);

        // art 
        drawArtPlaceholder(renderCtx);

        // manacost
        drawManaCost(renderCtx);

    }

    // Text box background
    drawTextBox(renderCtx);

    // Name line
    drawNameLine(renderCtx);

    // Type line
    drawTypeLine(renderCtx);

    // Edition badge
    drawEditionBadge(renderCtx);

    // Power/Toughness
    drawPowerToughness(renderCtx);

    // Rules text
    drawRulesText(renderCtx);

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

    console.log(`Drawing text box for face: ${face.name}, layout: ${layout}, rect: ${JSON.stringify(rect)}`);

    const fill = !face.manaCost && !face.isACreature
        ? getLandTextBoxFill(face)
        : getDefaultTextBoxFill(face);

    switch (fill.kind) {
        case "solid": {
            ctx.fillStyle = utils.toCommaRgb(...fill.color);
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            break;
        }

        case "split": {
            const gradient = ctx.createLinearGradient(
                rect.x,
                rect.y,
                rect.x + rect.width,
                rect.y
            );

            gradient.addColorStop(0, utils.toCommaRgb(...fill.first));
            gradient.addColorStop(0.37, utils.toCommaRgb(...fill.first));
            gradient.addColorStop(0.63, utils.toCommaRgb(...fill.second));
            gradient.addColorStop(1, utils.toCommaRgb(...fill.second));

            ctx.fillStyle = gradient;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            break;
        }

        case "striped": {
            for (let index = 0; index < 8; index++) {
                const inset = index * 6 * scene.scale;
                const color = fill.colors[index % 2];

                ctx.fillStyle = utils.toCommaRgb(...color);
                ctx.fillRect(
                    rect.x + inset,
                    rect.y + inset,
                    rect.width - inset * 2,
                    rect.height - inset * 2
                );
            }
            break;
        }
    }

    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = Math.max(1, scene.scale * 0.5);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

export function drawArtPlaceholder(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;

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