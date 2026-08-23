import { Color, FaceLayout } from "./types";

export const colors: { [key: string]: Color } = {
    // Background Color of Mana Symbols
    MBW: [245, 236, 170],
    MBU: [162, 198, 216],
    MBB: [174, 157, 146],
    MBC: [190, 180, 170],
    MBR: [211, 136, 112],
    MBG: [149, 182, 131],

    // Foreground Color of Mana Symbols
    MFW: [55, 54, 46],
    MFU: [42, 50, 50],
    MFB: [43, 41, 39],
    MFC: [43, 41, 39],
    MFR: [54, 40, 37],
    MFG: [39, 45, 37],

    // Average Frame Colors for PROXY FRAMES
    FL: [161, 137, 116],
    FR: [181, 85, 46],
    FZ: [181, 175, 84],
    FW: [216, 203, 175],
    FA: [104, 74, 44],
    FC: [18, 109, 103],
    FG: [65, 110, 65],
    FB: [39, 44, 38],
    FU: [70, 163, 199],

    // Average TextBoxes Land
    TBLZ: [230, 178, 100], // Default multicolor land text box color
    TBLB: [171, 166, 157],
    TBLU: [202, 213, 214],
    TBLR: [251, 210, 183],
    TBLG: [212, 222, 148],
    TBLW: [245, 220, 164],

    // Average TextBoxes  Spells	
    TBR: [207, 150, 126],
    TBZ: [210, 189, 185],
    TBW: [248, 245, 238],
    TBA: [241, 236, 224],
    TBC: [164, 165, 163],
    TBG: [211, 185, 138],
    TBB: [248, 217, 167],
    TBU: [234, 241, 247],
};

export enum frame {
    frameL, // enums default start at 0, so frameL = 0, frameA = 1, etc.
    frameA,
    frameW,
    frameU,
    frameB,
    frameR,
    frameG,
    frameZ,
}

// Land color by edition
export const LandColorByEdition: { [key: number]: Color } = {
    3: [254, 216, 179], // AN
    4: [224, 183, 169], // AQ
    5: [249, 223, 192], // LE
    6: [214, 206, 215], // DK
    7: [202, 165, 166], // FE
    8: [231, 241, 247], // IA
    9: [164, 194, 197], // HL
    10: [198, 207, 225], // AL
    11: [149, 179, 160], // MI
    12: [159, 180, 168], // VI
};

export const CardWidth = 232;
export const CardHeight = 330;
export const MCWidth = 12;

// FaceLayouts: 0=normal, 1=flipA, 2=splitA, 3=flipB, 4=splitB
export const FaceLayouts: { [key: number]: FaceLayout } = {
    0: {
        xback: 0,
        yback: 0,
        xbwidth: CardWidth,
        ybheight: CardHeight,
        xname: 9,
        yname: 3,
        xmana: 219,
        ymana: 2,
        xtypeline: 10,
        ytypeline: 183,
        xedition: 200,
        yedition: 184,
        xpowertough: 220,
        ypowertough: 307,
        xtext: 10,
        ytext: 205,
        textangle: 0,
        xtb: 18,
        ytb: 200,
        tbwidth: 196,
        tbheight: 106,
        xart: 17,
        yart: 20,
        artwidth: 198,
        artheight: 161,
    },

    // flip top
    1: {
        xback: 0,
        yback: 0,
        xbwidth: CardWidth,
        ybheight: CardHeight,
        xname: 8,
        yname: 3,
        xmana: 219,
        ymana: 2,
        xtypeline: 10,
        ytypeline: 88,
        xedition: 8,
        yedition: CardHeight - 13,


        xpowertough: 200,
        ypowertough: 89,

        xtext: 5,
        ytext: 212,
        textangle: 0,
        xtb: 18,
        ytb: 20,
        tbwidth: 196,
        tbheight: 70,
        xart: 17,
        yart: (CardHeight - 121) / 2,
        artwidth: 198,
        artheight: 121
    },
    // flip bottom
    3: {
        xback: 0,
        yback: 0,
        xbwidth: CardWidth,
        ybheight: CardHeight,
        xname: CardWidth - 9,
        yname: CardHeight - 4,
        xmana: 50,
        ymana: CardHeight - 3,
        xtypeline: CardWidth - 10,
        ytypeline: 241,
        xedition: 0, // unused
        yedition: 0, // unused

        xpowertough: 30,
        ypowertough: 240,


        xtext: 5,
        ytext: 40,
        textangle: 180,
        xtb: 18,
        ytb: 240,
        tbwidth: 196,
        tbheight: 70,
        xart: 17,
        yart: 100,
        artwidth: 198,
        artheight: 121
    },

    // split top
    2: {
        xback: 0,
        yback: CardHeight / 2,
        xbwidth: CardWidth,
        ybheight: CardHeight / 2,
        xname: 3,
        yname: CardHeight - 6,
        xmana: 1,
        ymana: 170,
        xtypeline: 124,
        ytypeline: CardHeight - 7,
        xedition: 125,
        yedition: 189,
        xpowertough: 200,
        ypowertough: 250,
        xtext: 150,
        ytext: 300,
        textangle: 90,
        xtb: 142,
        ytb: (CardHeight / 2) + 10,
        tbwidth: 78,
        tbheight: 145,
        xart: 18,
        yart: (CardHeight / 2) + 9,
        artwidth: 102,
        artheight: 147
    },

    // split bottom
    4: {
        xback: 0,
        yback: 0,
        xbwidth: CardWidth,
        ybheight: CardHeight / 2,
        xname: 3,
        yname: (CardHeight / 2) - 6,
        xmana: 1,
        ymana: 6,
        xtypeline: 124,
        ytypeline: (CardHeight / 2) - 7,
        xedition: 125,
        yedition: 25,
        xpowertough: 200,
        ypowertough: 30,
        xtext: 150,
        ytext: 120,
        textangle: 90,
        xtb: 142,
        ytb: 10,
        tbwidth: 78,
        tbheight: 145,
        xart: 18,
        yart: 9,
        artwidth: 102,
        artheight: 147
    }
};

export const TextSizeLimits = [
    [190, 88],
    [190, 62],
    [139, 65],
    [190, 62],
    [139, 65]
];

export const LineHeights = [
    16,
    13,
    11,
    9,
    7,
    5
];

export const ManaSymbols = [
    "{0}",
    "{1}",
    "{2}",
    "{3}",
    "{4}",
    "{5}",
    "{6}",
    "{7}",
    "{8}",
    "{9}",
    "{W}",
    "{U}",
    "{B}",
    "{R}",
    "{G}",
    "{T}",
    "{X}",
    "{Y}",
    "{Z}"
];

