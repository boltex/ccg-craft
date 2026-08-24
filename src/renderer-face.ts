import * as utils from "./utils";
import { getLandTextBoxFill, getDefaultTextBoxFill } from "./frame-colors";
import type { RenderFaceContext } from "./renderer";
import {
    getFaceBounds,
    getTextBoxRect,
    getArtRect,
} from "./renderer-geometry";
import * as constants from "./constants";

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

function drawNameLine(renderCtx: RenderFaceContext): void {
    // Let's use medieval.ttf (Medieval font family) for card name rendering,
    const { ctx, face, layout, scene } = renderCtx;

    // get angle
    const angle = layout.textangle;

    ctx.save();

    ctx.font = `${Math.max(13, 13 * scene.scale)}px Medieval, serif`;

    ctx.fillStyle = 'white';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    // no stroke 
    ctx.strokeStyle = 'transparent';

    // shadow behind the white text 
    ctx.shadowColor = 'black';
    ctx.shadowOffsetX = 0.5 * scene.scale;
    ctx.shadowOffsetY = 0.5 * scene.scale;
    ctx.shadowBlur = 0;

    // The important trick is to move the canvas origin to where you want the text, rotate the coordinate system, then draw the text at (0, 0).
    // ok now setup the rotation and draw the text
    ctx.translate(
        layout.xname + scene.offsetX,
        layout.yname + scene.offsetY
    );

    ctx.rotate((angle * Math.PI) / -180);
    ctx.fillText(face.name, 0, 0);
    ctx.restore();

}

function drawTypeLine(renderCtx: RenderFaceContext): void {
    // Use Plantin for type line, 12pt, white , left aligned, 1px shadow offset, no blur, no stroke.
    const { ctx, face, layout, scene } = renderCtx;

    // get angle
    const angle = layout.textangle;

    ctx.save();

    ctx.font = `${Math.max(11, 11 * scene.scale)}px Plantin, serif`;

    ctx.fillStyle = 'white';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    // no stroke 
    ctx.strokeStyle = 'transparent';

    // shadow behind the white text 
    ctx.shadowColor = 'black';
    ctx.shadowOffsetX = 0.5 * scene.scale;
    ctx.shadowOffsetY = 0.5 * scene.scale;
    ctx.shadowBlur = 0;

    ctx.translate(
        layout.xtypeline + scene.offsetX,
        layout.ytypeline + scene.offsetY
    );

    ctx.rotate((angle * Math.PI) / -180);
    ctx.fillText(face.typeLine, 0, 0);
    ctx.restore();

}

function drawEditionBadge(renderCtx: RenderFaceContext): void {

    // Has to be done in two passes: once with the ExpBack and once with
    // the ExpFront, because the ExpBack is a background for the ExpFront, and we want to draw the background first, then the front on top of it.
    const { ctx, face, layout, scene } = renderCtx;

    // get angle
    const angle = layout.textangle;

    ctx.save();

    ctx.font = `${Math.max(35, 35 * scene.scale)}px ExpBack, serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = "center";
    ctx.textBaseline = "hanging";
    // no stroke 
    ctx.strokeStyle = 'transparent';
    ctx.translate(
        layout.xedition + scene.offsetX,
        layout.yedition + scene.offsetY
    );

    ctx.rotate((angle * Math.PI) / -180);

    // Build character string for edition badge.
    // example from old basic code: stg$=CHR$(Edition(face)+32)
    const edString = String.fromCharCode(face.edition + 34);

    ctx.fillText(edString, 0, 0);

    ctx.font = `${Math.max(35, 35 * scene.scale)}px ExpFront, serif`;
    ctx.fillStyle = 'black';

    ctx.fillText(edString, 0, 0);

    ctx.restore();
}

function drawManaCost(renderCtx: RenderFaceContext): void {
    // Draw back of symbols first with the character 'o' with the Symbols font, 
    // then draw the front of the symbols with the character 'O' with the Symbols font, then draw the mana cost text with the character 'M' with the Symbols font.
    const { ctx, face, layout, scene } = renderCtx;

    if (!face.manaCost) {
        return
    }

    // get angle
    const angle = layout.textangle;

    ctx.save();
    ctx.font = `${Math.max(13, 13 * scene.scale)}px Symbols, serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "hanging";
    // no stroke
    ctx.strokeStyle = 'transparent';
    const manaCharWidth = 12 * scene.scale; // approximate width of a single mana symbol character
    const manaBackSymbol = "o"; // back of mana symbol

    // negative offset to emulate right-alignment of mana symbols, 
    // since we are drawing them left to right but want them to appear right-aligned.
    const leftOffset = face.manaCost.length * -manaCharWidth;

    for (let i = 0; i < face.manaCost.length; i++) {
        const manaSymbol = face.manaCost[i];
        let manaColor: [number, number, number] = [0, 0, 0];
        let manaBgColor: [number, number, number] = [0, 0, 0];

        switch (manaSymbol) {
            case "W":
                manaColor = constants.colors.MFW;
                manaBgColor = constants.colors.MBW;
                break;
            case "U":
                manaColor = constants.colors.MFU;
                manaBgColor = constants.colors.MBU;
                break;
            case "B":
                manaColor = constants.colors.MFB;
                manaBgColor = constants.colors.MBB;
                break;
            case "R":
                manaColor = constants.colors.MFR;
                manaBgColor = constants.colors.MBR;
                break;
            case "G":
                manaColor = constants.colors.MFG;
                manaBgColor = constants.colors.MBG;
                break;
            default:
                manaColor = constants.colors.MFC;
                manaBgColor = constants.colors.MBC;
                break;
        }

        let x;
        let y;

        if (angle === 90) {
            x = layout.xmana + scene.offsetX;
            y = (-leftOffset) + layout.ymana + scene.offsetY - (i * manaCharWidth);
        } else {
            x = leftOffset + layout.xmana + scene.offsetX + (i * manaCharWidth);
            y = layout.ymana + scene.offsetY;
        }

        ctx.save();

        ctx.translate(x, y);
        ctx.rotate((angle * Math.PI) / -180);

        // Draw the back of the mana symbol
        ctx.fillStyle = utils.toCommaRgb(...manaBgColor);
        ctx.fillText(manaBackSymbol, 0, 0);

        // Draw the front of the mana symbol
        ctx.fillStyle = utils.toCommaRgb(...manaColor);
        ctx.fillText(manaSymbol, 0, 0);

        ctx.restore();
    }

    ctx.restore();

}

function drawPowerToughness(renderCtx: RenderFaceContext): void {

    const { ctx, face, layout, scene } = renderCtx;

    if (!face.isACreature) {
        return;
    }

    // get angle
    const angle = layout.textangle;

    ctx.save();

    ctx.font = `${Math.max(13, 13 * scene.scale)}px Plantin, serif`;

    ctx.fillStyle = 'white';
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    // no stroke 
    ctx.strokeStyle = 'transparent';

    // shadow behind the white text 
    ctx.shadowColor = 'black';
    ctx.shadowOffsetX = 0.5 * scene.scale;
    ctx.shadowOffsetY = 0.5 * scene.scale;
    ctx.shadowBlur = 0;

    ctx.translate(
        layout.xpowertough + scene.offsetX,
        layout.ypowertough + scene.offsetY
    );

    ctx.rotate((angle * Math.PI) / -180);
    ctx.fillText(face.powerToughness, 0, 0);

    ctx.restore();

}

function drawRulesText(renderCtx: RenderFaceContext): void {

    // Todo

}
