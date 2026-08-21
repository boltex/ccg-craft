import type { Color, PrintableFace } from "./types";

export type TextBoxFill =
    | { kind: "solid"; color: Color }
    | { kind: "split"; first: Color; second: Color }
    | { kind: "striped"; colors: [Color, Color] };

export function getLandTextBoxFill(face: PrintableFace): TextBoxFill {
    // todo: implement this function
    return { kind: "solid", color: [0, 0, 0] };
};

export function getDefaultTextBoxFill(face: PrintableFace): TextBoxFill {
    // todo: implement this function
    return { kind: "solid", color: [0, 0, 0] };
}
