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