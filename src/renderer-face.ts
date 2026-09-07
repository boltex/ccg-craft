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
import type { Color } from "./types";

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
        textBaseline: "hanging",
        ...overrides,
    };
}

function drawRectangleBevel(
    surface: RenderFaceContext["surface"],
    x: number,
    y: number,
    width: number,
    height: number,
    intensity: number,
    lightColor: Color,
    darkColor: Color,
    useTopLeftLight = false,
): void {
    const bevelWidth = Math.min(
        Math.abs(intensity),
        width / 2,
        height / 2,
    );

    if (bevelWidth <= 0) {
        return;
    }

    const outerLeft = intensity >= 0 ? x : x - bevelWidth;
    const outerTop = intensity >= 0 ? y : y - bevelWidth;
    const outerRight = intensity >= 0 ? x + width : x + width + bevelWidth;
    const outerBottom = intensity >= 0 ? y + height : y + height + bevelWidth;
    const innerLeft = intensity >= 0 ? x + bevelWidth : x;
    const innerTop = intensity >= 0 ? y + bevelWidth : y;
    const innerRight = intensity >= 0 ? x + width - bevelWidth : x + width;
    const innerBottom = intensity >= 0 ? y + height - bevelWidth : y + height;

    if (useTopLeftLight) {
        surface.setFillStyle(utils.toCommaRgb(...lightColor));
        surface.beginPath();
        surface.moveTo(outerLeft, outerTop);
        surface.lineTo(outerRight, outerTop);
        surface.lineTo(innerRight, innerTop);
        surface.lineTo(innerLeft, innerTop);
        surface.lineTo(innerLeft, innerBottom);
        surface.lineTo(outerLeft, outerBottom);
        surface.closePath();
        surface.fill();

        surface.setFillStyle(utils.toCommaRgb(...darkColor));
        surface.beginPath();
        surface.moveTo(outerRight, outerTop);
        surface.lineTo(outerRight, outerBottom);
        surface.lineTo(outerLeft, outerBottom);
        surface.lineTo(innerLeft, innerBottom);
        surface.lineTo(innerRight, innerBottom);
        surface.lineTo(innerRight, innerTop);
        surface.closePath();
        surface.fill();

        return;
    }

    surface.setFillStyle(utils.toCommaRgb(...lightColor));
    surface.beginPath();
    surface.moveTo(outerLeft, outerTop);
    surface.lineTo(outerRight, outerTop);
    surface.lineTo(outerRight, outerBottom);
    surface.lineTo(innerRight, innerBottom);
    surface.lineTo(innerRight, innerTop);
    surface.lineTo(innerLeft, innerTop);
    surface.closePath();
    surface.fill();

    surface.setFillStyle(utils.toCommaRgb(...darkColor));
    surface.beginPath();
    surface.moveTo(outerLeft, outerTop);
    surface.lineTo(innerLeft, innerTop);
    surface.lineTo(innerLeft, innerBottom);
    surface.lineTo(innerRight, innerBottom);
    surface.lineTo(outerRight, outerBottom);
    surface.lineTo(outerLeft, outerBottom);
    surface.closePath();
    surface.fill();
}

export function renderFace(renderCtx: RenderFaceContext): void {

    const { face } = renderCtx;

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

        // Artist credit
        drawArtistCredit(renderCtx);

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
    const { surface, face, layout, scene } = renderCtx;
    const bounds = getFaceBounds(layout, scene.offsetX, scene.offsetY);

    surface.setFillStyle(utils.toCommaRgb(...face.faceColors.frameColor));
    surface.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Now draw a bevel inside the frame to give it some depth
    // using utils.darkenColor and utils.lightenColor. 
    // Top and right sides are lighter, while bottom and left sides are darker.
    const lightColor = utils.lightenColor(face.faceColors.frameColor, 0.2);
    const darkColor = utils.darkenColor(face.faceColors.frameColor, 0.2);
    const bevelWidth = (face.faceLayout === 2 || face.faceLayout === 4 ? 1.5 : 2) * scene.scale;

    drawRectangleBevel(
        surface,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        bevelWidth,
        lightColor,
        darkColor,
        face.faceLayout === 2 || face.faceLayout === 4
    );

    // ctx.strokeStyle = "black";
    surface.setStrokeStyle("rgba(0, 0, 0, 0.35)");
    surface.setLineWidth(Math.max(1, scene.scale));
    surface.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function drawTextBox(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;
    const textBoxRect = getTextBoxRect(layout, scene.offsetX, scene.offsetY);
    const faceBounds = getFaceBounds(layout, scene.offsetX, scene.offsetY);
    const cardBevelWidth = (face.faceLayout === 2 || face.faceLayout === 4 ? 1.5 : 2) * scene.scale;

    const artBoxRect = getArtRect(layout, scene.offsetX, scene.offsetY);
    const artBevelWidth = (face.faceLayout === 2 || face.faceLayout === 4 ? 3 : 4) * scene.scale;
    const textBoxBevelWidth = (face.faceLayout === 2 || face.faceLayout === 4 ? 2 : 3) * scene.scale;

    const isLand = !face.manaCost && !face.isACreature;

    const fill = isLand
        ? getLandTextBoxFill(face)
        : getDefaultTextBoxFill(face);

    switch (fill.kind) {
        case "solid": {
            surface.setFillStyle(utils.toCommaRgb(...fill.color));
            surface.fillRect(textBoxRect.x, textBoxRect.y, textBoxRect.width, textBoxRect.height);
            break;
        }

        case "split": {
            surface.setFillStyle({
                kind: "linear-gradient",
                x0: textBoxRect.x,
                y0: textBoxRect.y,
                x1: textBoxRect.x + textBoxRect.width,
                y1: textBoxRect.y,
                stops: [
                    { offset: 0, color: utils.toCommaRgb(...fill.first) },
                    { offset: 0.37, color: utils.toCommaRgb(...fill.first) },
                    { offset: 0.63, color: utils.toCommaRgb(...fill.second) },
                    { offset: 1, color: utils.toCommaRgb(...fill.second) },
                ],
            });
            surface.fillRect(textBoxRect.x, textBoxRect.y, textBoxRect.width, textBoxRect.height);
            break;
        }

        case "striped": {
            for (let index = 0; index < 8; index++) {
                const inset = index * 6 * scene.scale;
                const color = fill.colors[index % 2];

                surface.setFillStyle(utils.toCommaRgb(...color));
                surface.fillRect(
                    textBoxRect.x + inset,
                    textBoxRect.y + inset,
                    textBoxRect.width - inset * 2,
                    textBoxRect.height - inset * 2
                );
            }
            break;
        }
    }

    surface.setStrokeStyle("rgba(0, 0, 0, 0.25)");
    surface.setLineWidth(Math.max(1, scene.scale * 0.5));
    surface.strokeRect(textBoxRect.x, textBoxRect.y, textBoxRect.width, textBoxRect.height);

    if (isLand) {

        // Add border around text box, the art's bevel, and the card frame.
        let color1;
        let color2;

        switch (fill.kind) {
            case "solid": {
                color1 = fill.color;
                color2 = fill.color;
                break;
            }
            case "split": {
                color1 = fill.first;
                color2 = fill.second;
                break;
            }

            case "striped": {
                color1 = fill.colors[0];
                color2 = fill.colors[1];
                break;
            }
        }

        // Darken a bit the colors for the border effect
        color1 = utils.darkenColor(color1, 0.2);
        color2 = utils.darkenColor(color2, 0.2);

        // first, lets use color2
        surface.setStrokeStyle(utils.toCommaRgb(...color2));
        // surface.setLineWidth(Math.max(1, scene.scale * 0.5));
        surface.setLineWidth(scene.scale * 0.5);
        surface.strokeRect(faceBounds.x + cardBevelWidth, faceBounds.y + cardBevelWidth, faceBounds.width - cardBevelWidth * 2, faceBounds.height - cardBevelWidth * 2);

        // Next another line using color1 around artbox
        surface.setStrokeStyle(utils.toCommaRgb(...color1));
        // surface.setLineWidth(Math.max(1, scene.scale * 0.5));
        surface.setLineWidth(scene.scale * 1);
        surface.strokeRect(artBoxRect.x - artBevelWidth, artBoxRect.y - artBevelWidth, artBoxRect.width + artBevelWidth * 2, artBoxRect.height + artBevelWidth * 2);

        if (fill.kind === "solid") {
            drawRectangleBevel(
                surface,
                textBoxRect.x,
                textBoxRect.y,
                textBoxRect.width,
                textBoxRect.height,
                textBoxBevelWidth,
                color1,
                color2,
                face.faceLayout === 2 || face.faceLayout === 4
            );
        } else if (fill.kind === "striped") {

            // Finally, the two bevels in the textbox
            drawRectangleBevel(
                surface,
                textBoxRect.x,
                textBoxRect.y,
                textBoxRect.width,
                textBoxRect.height,
                textBoxBevelWidth / 2,
                color1,
                color2,
                face.faceLayout === 2 || face.faceLayout === 4
            );
            // Second one with reversed colors
            drawRectangleBevel(
                surface,
                textBoxRect.x + textBoxBevelWidth / 2,
                textBoxRect.y + textBoxBevelWidth / 2,
                textBoxRect.width - textBoxBevelWidth,
                textBoxRect.height - textBoxBevelWidth,
                textBoxBevelWidth / 2,
                color2,
                color1,
                face.faceLayout === 2 || face.faceLayout === 4
            );
        } else if (fill.kind === "split") {

            // Handle gradient fill for the text box
            drawRectangleBevel(
                surface,
                textBoxRect.x,
                textBoxRect.y,
                textBoxRect.width,
                textBoxRect.height,
                textBoxBevelWidth,
                color2,
                color1,
                face.faceLayout === 2 || face.faceLayout === 4
            );

        }


    } else if (fill.kind === "solid") {

        // Add border around the text box for non-lands.

        // TODO: Replace with proper text box effect specific to non-land cards color scheme.

        const lightColor = utils.lightenColor(fill.color, 0.3);
        const darkColor = utils.darkenColor(fill.color, 0.18);

        drawRectangleBevel(
            surface,
            textBoxRect.x,
            textBoxRect.y,
            textBoxRect.width,
            textBoxRect.height,
            textBoxBevelWidth,
            darkColor,
            lightColor,
            face.faceLayout === 2 || face.faceLayout === 4
        );

    }


}

function drawArtOuterBevel(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;
    const rect = getArtRect(layout, scene.offsetX, scene.offsetY);

    const lightColor = utils.lightenColor(face.faceColors.frameColor, 0.24);
    const darkColor = utils.darkenColor(face.faceColors.frameColor, 0.24);

    const bevelWidth = (face.faceLayout === 2 || face.faceLayout === 4 ? 3 : 4) * scene.scale;

    drawRectangleBevel(
        surface,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        -bevelWidth,
        darkColor,
        lightColor,
        face.faceLayout === 2 || face.faceLayout === 4
    );
}

function drawArtBitmap(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;

    const rect = getArtRect(layout, scene.offsetX, scene.offsetY);
    const artImage = renderCtx.options.artByFaceSerial?.get(face.serial);
    const shouldRotateArt = face.faceLayout === 2 || face.faceLayout === 4;

    drawArtOuterBevel(renderCtx);

    if (artImage) {
        if (shouldRotateArt) {
            surface.save();
            surface.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
            surface.rotate((90 * Math.PI) / -180);
            surface.drawImage(artImage, -rect.height / 2, -rect.width / 2, rect.height, rect.width);
            surface.restore();
        } else {
            surface.drawImage(artImage, rect.x, rect.y, rect.width, rect.height);
        }

        surface.setStrokeStyle("rgba(0, 0, 0, 0.35)");
        surface.setLineWidth(Math.max(1, scene.scale * 0.5));
        surface.strokeRect(rect.x, rect.y, rect.width, rect.height);
        return;
    }

    const artPath = utils.toArtRelativePath(face.name);

    surface.setFillStyle("rgba(255, 255, 255, 0.18)");
    surface.fillRect(rect.x, rect.y, rect.width, rect.height);

    surface.setStrokeStyle("rgba(0, 0, 0, 0.35)");
    surface.setLineWidth(Math.max(1, scene.scale * 0.5));
    surface.strokeRect(rect.x, rect.y, rect.width, rect.height);

    const label = ["ART", artPath].join("\n");
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const lines = label.split("\n");
    const lineHeight = 14 * scene.scale;
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

    for (let index = 0; index < lines.length; index++) {
        drawStyledText(surface, lines[index], centerX, startY + index * lineHeight, {
            fontFamily: "serif",
            fontSize: 10 * scene.scale,
            fillStyle: "rgba(0, 0, 0, 0.75)",
            textAlign: "center",
            textBaseline: "hanging",
            maxWidth: rect.width - 8 * scene.scale,
        });
    }
}

function drawNameLine(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;
    drawStyledText(surface, face.name,
        layout.xname + scene.offsetX,
        layout.yname + scene.offsetY,
        getCardTextStyle(scene.scale, "Medieval, serif", 13, {
            rotationDegrees: layout.textangle,
        })
    );
}

function drawTypeLine(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;
    drawStyledText(surface, face.typeLine,
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
    const { surface, face, layout, scene } = renderCtx;

    // Build character string for edition badge.
    // example from old basic code: stg$=CHR$(Edition(face)+32)
    const edString = String.fromCharCode(face.edition + 34);

    drawStyledText(
        surface,
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
        surface,
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

function drawArtistCredit(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;
    if (!face.artist) {
        return;
    }
    drawStyledText(
        surface,
        "Illus. " + face.artist,
        layout.xartist + scene.offsetX,
        layout.yartist + scene.offsetY,
        getCardTextStyle(scene.scale, "Plantin, serif", 10, {
            textAlign: "left",
            rotationDegrees: layout.textangle,
        })
    );

}

function drawManaCost(renderCtx: RenderFaceContext): void {
    const { surface, face, layout, scene } = renderCtx;

    if (!face.manaCost) {
        return;
    }

    drawManaCostRow(
        surface,
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

    const { surface, face, layout, scene } = renderCtx;

    if (!face.isACreature) {
        return;
    }

    drawStyledText(surface, face.powerToughness,
        layout.xpowertough + scene.offsetX,
        layout.ypowertough + scene.offsetY,
        getCardTextStyle(scene.scale, "Plantin, serif", 13, {
            textAlign: "right",
            rotationDegrees: layout.textangle,
        })
    );
}

function drawRulesText(renderCtx: RenderFaceContext): void {

    const { surface, face, layout, scene } = renderCtx;
    const fittedLayout = fitRulesText(surface, face, layout, scene.scale);

    drawWrappedRulesText(
        surface,
        fittedLayout,
        layout,
        scene.offsetX,
        scene.offsetY,
    );

}
