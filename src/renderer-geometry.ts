import type { FaceLayout } from "./types";
import * as utils from "./utils";
import * as constants from "./constants";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export function getScaledFaceLayout(faceLayout: number, scale: number): FaceLayout {
    return utils.scaleFaceLayout(constants.FaceLayouts[faceLayout], scale);
}

export function getFaceBounds(layout: FaceLayout, offsetX: number, offsetY: number): Rect {
    return { x: offsetX + layout.xback, y: offsetY + layout.yback, width: layout.xbwidth, height: layout.ybheight };
}

export function getTextBoxRect(layout: FaceLayout, offsetX: number, offsetY: number): Rect {
    return { x: offsetX + layout.xtb, y: offsetY + layout.ytb, width: layout.tbwidth, height: layout.tbheight };
};

export function getArtRect(layout: FaceLayout, offsetX: number, offsetY: number): Rect {
    return { x: offsetX + layout.xart, y: offsetY + layout.yart, width: layout.artwidth, height: layout.artheight };
};
