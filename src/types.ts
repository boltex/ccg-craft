export type card = {
    serial: number;
    edition: string; // Edition abbreviation, e.g., "IN". Not a number in cards.
    name: string;
    face1: number;
    face2: number;
}

export type cardFace = {
    faceSerial: number;
    parentCard: number;
    faceType: number;
    edition: number; // Edition number, not abbreviation.
    nameIndex: number;
    manaCostIndex: number;
    typeLineIndex: number;
    isACreature: boolean;
    powerToughness: number[]; // either empty or has two elements: [power, toughness]
    textLines: number[]; // array of text lines indexes
};

export type PrintableFace = {
    faceLayout: number; // 0=normal   1=flipA   2=splitA  3 = flipB    4=splitB
    serial: number;

    name: string;
    manaCost: string;
    typeLine: string;
    edition: number; // Edition number, not abbreviation
    isACreature: boolean;
    powerToughness: string; // either empty or has two elements: [power, toughness]
    textLines: string[]; // array of text lines indexes

    colorState: number;
    faceFrame: number;
}

export type Color = [number, number, number]; // RGB color

// There will be 4 FaceLayouts: 0=normal, 1=flipA, 2=splitA, 3=flipB, 4=splitB
export type FaceLayout = {
    xback: number;
    yback: number;
    xbwidth: number;
    ybheight: number;
    xname: number;
    yname: number;
    xmana: number;
    ymana: number;
    xtypeline: number;
    ytypeline: number;
    xedition: number;
    yedition: number;
    xpowertough: number;
    ypowertough: number;
    xtext: number;
    ytext: number;
    textangle: number;
    xtb: number;
    ytb: number;
    tbwidth: number;
    tbheight: number;
    xart: number;
    yart: number;
    artwidth: number;
    artheight: number;
}