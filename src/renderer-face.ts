import * as utils from "./utils";
import { getLandTextBoxFill, getDefaultTextBoxFill } from "./frame-colors";
import type { RenderFaceContext } from "./renderer";
import {
    getFaceBounds,
    getTextBoxRect,
    getArtRect,
} from "./renderer-geometry";
import { drawStyledText, type TextStyle } from "./renderer-text";
import { drawManaCostRow } from "./renderer-symbols";

type CardTextStyleOverrides = TextStyle;

function getCardTextStyle(
    sceneScale: number,
    fontFamily: string,
    baseSize: number,
    overrides: Partial<CardTextStyleOverrides> = {}
): CardTextStyleOverrides {
    return {
        fontFamily,
        fontSize: Math.max(baseSize, baseSize * sceneScale),
        fillStyle: "white",
        strokeStyle: "transparent",
        shadowColor: "black",
        shadowOffsetX: 0.5 * sceneScale,
        shadowOffsetY: 0.5 * sceneScale,
        textAlign: "left",
        textBaseline: "top",
        ...overrides,
    };
}

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

        // Edition badge
        drawEditionBadge(renderCtx);

    }

    // Text box background
    drawTextBox(renderCtx);

    // Name line
    drawNameLine(renderCtx);

    // Type line
    drawTypeLine(renderCtx);

    // Power/Toughness
    drawPowerToughness(renderCtx);

    // Rules text
    drawRulesText(renderCtx);

}

function drawFrameBackground(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    const bounds = getFaceBounds(layout, scene.offsetX, scene.offsetY);

    ctx.fillStyle = utils.toCommaRgb(...face.faceColors.frameColor);
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.strokeStyle = "black";
    ctx.lineWidth = Math.max(1, scene.scale);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function drawTextBox(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    const rect = getTextBoxRect(layout, scene.offsetX, scene.offsetY);


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

function drawArtPlaceholder(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;

    const rect = getArtRect(layout, scene.offsetX, scene.offsetY);
    const artPath = utils.toArtRelativePath(face.name);

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = Math.max(1, scene.scale * 0.5);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    const label = ["ART", artPath].join("\n");
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const lines = label.split("\n");
    const lineHeight = 14 * scene.scale;
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

    for (let index = 0; index < lines.length; index++) {
        drawStyledText(ctx, lines[index], centerX, startY + index * lineHeight, {
            fontFamily: "serif",
            fontSize: Math.max(10, 10 * scene.scale),
            fillStyle: "rgba(0, 0, 0, 0.75)",
            textAlign: "center",
            textBaseline: "middle",
            maxWidth: rect.width - 8 * scene.scale,
        });
    }

    // Todo last in the project: implement actual art rendering, including loading the image and drawing it to the canvas.
}

function drawNameLine(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    drawStyledText(ctx, face.name,
        layout.xname + scene.offsetX,
        layout.yname + scene.offsetY,
        getCardTextStyle(scene.scale, "Medieval, serif", 13, {
            rotationDegrees: layout.textangle,
        })
    );
}

function drawTypeLine(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    drawStyledText(ctx, face.typeLine,
        layout.xtypeline + scene.offsetX,
        layout.ytypeline + scene.offsetY,
        getCardTextStyle(scene.scale, "Plantin, serif", 11, {
            rotationDegrees: layout.textangle,
        })
    );
}

function drawEditionBadge(renderCtx: RenderFaceContext): void {

    // Has to be done in two passes: once with the ExpBack and once with
    // the ExpFront, because the ExpBack is a background for the ExpFront, and we want to draw the background first, then the front on top of it.
    const { ctx, face, layout, scene } = renderCtx;

    // Build character string for edition badge.
    // example from old basic code: stg$=CHR$(Edition(face)+32)
    const edString = String.fromCharCode(face.edition + 34);

    drawStyledText(
        ctx,
        edString,
        layout.xedition + scene.offsetX,
        layout.yedition + scene.offsetY,
        {
            ...getCardTextStyle(scene.scale, "ExpBack, serif", 35, {
                shadowColor: "transparent",
                shadowOffsetX: 0,
                shadowOffsetY: 0,
            }),
            fillStyle: "white",
            textAlign: "left",
            textBaseline: "hanging",
            rotationDegrees: layout.textangle,
        }
    );

    drawStyledText(
        ctx,
        edString,
        layout.xedition + scene.offsetX,
        layout.yedition + scene.offsetY,
        {
            ...getCardTextStyle(scene.scale, "ExpFront, serif", 35, {
                shadowColor: "transparent",
                shadowOffsetX: 0,
                shadowOffsetY: 0,
            }),
            fillStyle: "black",
            textAlign: "left",
            textBaseline: "hanging",
            rotationDegrees: layout.textangle,
        }
    );
}

function drawManaCost(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;

    if (!face.manaCost) {
        return;
    }

    drawManaCostRow(
        ctx,
        face.manaCost,
        layout.xmana + scene.offsetX,
        layout.ymana + scene.offsetY,
        {
            direction: layout.textangle === 90 ? "vertical" : "horizontal",
            size: Math.max(13, 13 * scene.scale),
            align: "end",
            rotationDegrees: layout.textangle,
        }
    );
}

function drawPowerToughness(renderCtx: RenderFaceContext): void {

    const { ctx, face, layout, scene } = renderCtx;

    if (!face.isACreature) {
        return;
    }

    drawStyledText(ctx, face.powerToughness,
        layout.xpowertough + scene.offsetX,
        layout.ypowertough + scene.offsetY,
        getCardTextStyle(scene.scale, "Plantin, serif", 13, {
            textAlign: "right",
            rotationDegrees: layout.textangle,
        })
    );
}

function drawRulesText(renderCtx: RenderFaceContext): void {

    // Todo later

}
