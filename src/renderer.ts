import * as constants from "./constants";
import { createCanvasRenderSurface, type RenderSurface } from "./renderer-surface";
import type { PrintableFace, FaceLayout } from "./types";
import { getScaledFaceLayout } from "./renderer-geometry";
import {
    renderFace
} from "./renderer-face";

export type RenderCardOptions = {
    padding?: number;
    background?: string;
    artByFaceSerial?: ReadonlyMap<number, CanvasImageSource>;
};

export type RenderCardScene = {
    scale: number;
    offsetX: number;
    offsetY: number;
    cardWidth: number;
    cardHeight: number;
};

export type RenderFaceContext = {
    ctx: CanvasRenderingContext2D;
    surface: RenderSurface;
    scene: RenderCardScene;
    face: PrintableFace;
    layout: FaceLayout;
    options: RenderCardOptions;
};

export function renderCardPreview(
    ctx: CanvasRenderingContext2D,
    faces: Array<PrintableFace | undefined>,
    options: RenderCardOptions = {}
): void {
    const canvas = ctx.canvas as HTMLCanvasElement;
    const scene = createRenderScene(canvas, options);
    const surface = createCanvasRenderSurface(ctx);

    surface.clearRect(0, 0, canvas.width, canvas.height);

    if (options.background) {
        surface.setFillStyle(options.background);
        surface.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const face of faces) {
        if (!face) {
            continue;
        }

        const layout = getScaledFaceLayout(face.faceLayout, scene.scale);

        renderFace({
            ctx,
            surface,
            scene,
            face,
            layout,
            options,
        });
    }
}

export function createRenderScene(
    canvas: HTMLCanvasElement,
    options: RenderCardOptions = {}
): RenderCardScene {
    const padding = options.padding ?? 20;
    const availableWidth = Math.max(1, canvas.width - padding * 2);
    const availableHeight = Math.max(1, canvas.height - padding * 2);

    const scale = Math.min(
        availableWidth / constants.CardWidth,
        availableHeight / constants.CardHeight
    );

    const cardWidth = constants.CardWidth * scale;
    const cardHeight = constants.CardHeight * scale;

    return {
        scale,
        offsetX: (canvas.width - cardWidth) / 2,
        offsetY: (canvas.height - cardHeight) / 2,
        cardWidth,
        cardHeight,
    };
}