import * as utils from "./utils";
import { getLandTextBoxFill, getDefaultTextBoxFill } from "./frame-colors";
import type { RenderFaceContext } from "./renderer";
import {
    getFaceBounds,
    getTextBoxRect,
    getArtRect,
} from "./renderer-geometry";
import { drawWrappedRulesText, fitRulesText } from "./renderer-rules";
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
        fontSize: baseSize * sceneScale,
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
        drawArtBitmap(renderCtx);

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

    // Now draw a bevel inside the frame to give it some depth
    // using utils.darkenColor and utils.lightenColor. 
    // Top and right sides are lighter, while bottom and left sides are darker.
    const lightColor = utils.lightenColor(face.faceColors.frameColor, 0.2);
    const darkColor = utils.darkenColor(face.faceColors.frameColor, 0.2);

    const bevelWidth = Math.min(
        2 * scene.scale,
        bounds.width / 2,
        bounds.height / 2,
    );
    if (bevelWidth > 0) {
        const x = bounds.x;
        const y = bounds.y;
        const right = bounds.x + bounds.width;
        const bottom = bounds.y + bounds.height;
        const innerLeft = x + bevelWidth;
        const innerTop = y + bevelWidth;
        const innerRight = right - bevelWidth;
        const innerBottom = bottom - bevelWidth;

        ctx.fillStyle = utils.toCommaRgb(...lightColor);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(right, y);
        ctx.lineTo(right, bottom);
        ctx.lineTo(innerRight, innerBottom);
        ctx.lineTo(innerRight, innerTop);
        ctx.lineTo(innerLeft, innerTop);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = utils.toCommaRgb(...darkColor);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(innerLeft, innerTop);
        ctx.lineTo(innerLeft, innerBottom);
        ctx.lineTo(innerRight, innerBottom);
        ctx.lineTo(right, bottom);
        ctx.lineTo(x, bottom);
        ctx.closePath();
        ctx.fill();
    }


    // ctx.strokeStyle = "black";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
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

function drawArtOuterBevel(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;
    const rect = getArtRect(layout, scene.offsetX, scene.offsetY);
    const bevelWidth = Math.min(
        4 * scene.scale,
        rect.width / 2,
        rect.height / 2,
    );

    if (bevelWidth <= 0) {
        return;
    }

    const lightColor = utils.lightenColor(face.faceColors.frameColor, 0.24);
    const darkColor = utils.darkenColor(face.faceColors.frameColor, 0.24);
    const outerLeft = rect.x - bevelWidth;
    const outerTop = rect.y - bevelWidth;
    const outerRight = rect.x + rect.width + bevelWidth;
    const outerBottom = rect.y + rect.height + bevelWidth;
    const innerLeft = rect.x;
    const innerTop = rect.y;
    const innerRight = rect.x + rect.width;
    const innerBottom = rect.y + rect.height;

    ctx.fillStyle = utils.toCommaRgb(...darkColor);
    ctx.beginPath();
    ctx.moveTo(outerLeft, outerTop);
    ctx.lineTo(outerRight, outerTop);
    ctx.lineTo(outerRight, outerBottom);
    ctx.lineTo(innerRight, innerBottom);
    ctx.lineTo(innerRight, innerTop);
    ctx.lineTo(innerLeft, innerTop);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = utils.toCommaRgb(...lightColor);
    ctx.beginPath();
    ctx.moveTo(outerLeft, outerTop);
    ctx.lineTo(innerLeft, innerTop);
    ctx.lineTo(innerLeft, innerBottom);
    ctx.lineTo(innerRight, innerBottom);
    ctx.lineTo(outerRight, outerBottom);
    ctx.lineTo(outerLeft, outerBottom);
    ctx.closePath();
    ctx.fill();
}

function drawArtBitmap(renderCtx: RenderFaceContext): void {
    const { ctx, face, layout, scene } = renderCtx;

    const rect = getArtRect(layout, scene.offsetX, scene.offsetY);
    const artImage = renderCtx.options.artByFaceSerial?.get(face.serial);
    const shouldRotateArt = face.faceLayout === 2 || face.faceLayout === 4;

    drawArtOuterBevel(renderCtx);

    if (artImage) {
        if (shouldRotateArt) {
            ctx.save();
            ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
            ctx.rotate((90 * Math.PI) / -180);
            ctx.drawImage(artImage, -rect.height / 2, -rect.width / 2, rect.height, rect.width);
            ctx.restore();
        } else {
            ctx.drawImage(artImage, rect.x, rect.y, rect.width, rect.height);
        }

        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = Math.max(1, scene.scale * 0.5);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        return;
    }

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
            fontSize: 10 * scene.scale,
            fillStyle: "rgba(0, 0, 0, 0.75)",
            textAlign: "center",
            textBaseline: "middle",
            maxWidth: rect.width - 8 * scene.scale,
        });
    }
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
            size: 13 * scene.scale,
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

    const { ctx, face, layout, scene } = renderCtx;
    const fittedLayout = fitRulesText(ctx, face, layout, scene.scale);

    drawWrappedRulesText(
        ctx,
        fittedLayout,
        layout,
        scene.offsetX,
        scene.offsetY,
    );

}
