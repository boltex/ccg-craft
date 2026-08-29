import * as constants from "./constants";
import {
    createCanvasRenderSurface,
    type RenderImageSource,
    type RenderSurface,
    type RenderSurfaceSize,
} from "./renderer-surface";
import type { PrintableFace, FaceLayout } from "./types";
import { getScaledFaceLayout } from "./renderer-geometry";
import {
    renderFace
} from "./renderer-face";

export type RenderCardOptions = {
    padding?: number;
    background?: string;
    artByFaceSerial?: ReadonlyMap<number, RenderImageSource>;
};

export type RenderCardScene = {
    scale: number;
    offsetX: number;
    offsetY: number;
    cardWidth: number;
    cardHeight: number;
};

export type RenderFaceContext = {
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
    const surface = createCanvasRenderSurface(ctx);
    renderCardToSurface(surface, faces, options);
}

export function renderCardToSurface(
    surface: RenderSurface,
    faces: Array<PrintableFace | undefined>,
    options: RenderCardOptions = {}
): void {
    const scene = createRenderScene(surface, options);

    surface.clearRect(0, 0, surface.width, surface.height);

    if (options.background) {
        surface.setFillStyle(options.background);
        surface.fillRect(0, 0, surface.width, surface.height);
    }

    for (const face of faces) {
        if (!face) {
            continue;
        }

        const layout = getScaledFaceLayout(face.faceLayout, scene.scale);

        renderFace({
            surface,
            scene,
            face,
            layout,
            options,
        });
    }
}

export function createRenderScene(
    target: RenderSurfaceSize,
    options: RenderCardOptions = {}
): RenderCardScene {
    const padding = options.padding ?? 20;
    const availableWidth = Math.max(1, target.width - padding * 2);
    const availableHeight = Math.max(1, target.height - padding * 2);

    const scale = Math.min(
        availableWidth / constants.CardWidth,
        availableHeight / constants.CardHeight
    );

    const cardWidth = constants.CardWidth * scale;
    const cardHeight = constants.CardHeight * scale;

    return {
        scale,
        offsetX: (target.width - cardWidth) / 2,
        offsetY: (target.height - cardHeight) / 2,
        cardWidth,
        cardHeight,
    };
}