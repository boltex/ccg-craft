import * as constants from "./constants";
import type { Color, PrintableFace } from "./types";

export type TextBoxFill =
    | { kind: "solid"; color: Color }
    | { kind: "split"; first: Color; second: Color }
    | { kind: "striped"; colors: [Color, Color] };

const whiteLandColor: Color = [241, 215, 139]; // 242, 200, 103
const blueLandColor: Color = [180, 206, 215]; // 133, 194, 214
const redLandColor: Color = [247, 201, 185]; // 247, 157, 127
const greenLandColor: Color = [199, 215, 125]; // 197, 219, 100
const blackLandColor: Color = [156, 153, 140]; // 135, 131, 112

const monoLandOverrides = new Map<string, Color>([
    ["Plains", constants.colors.TBLW],
    ["Snow-Covered Plains", constants.colors.TBLW],
    ["Ancient Den", constants.colors.TBLW],

    ["Island", constants.colors.TBLU],
    ["Snow-Covered Island", constants.colors.TBLU],
    ["Seat of the Synod", constants.colors.TBLU],

    ["Swamp", constants.colors.TBLB],
    ["Snow-Covered Swamp", constants.colors.TBLB],
    ["Vault of Whispers", constants.colors.TBLB],

    ["Mountain", constants.colors.TBLR],
    ["Snow-Covered Mountain", constants.colors.TBLR],
    ["Great Furnace", constants.colors.TBLR],

    ["Forest", constants.colors.TBLG],
    ["Snow-Covered Forest", constants.colors.TBLG],
    ["Tree of Tales", constants.colors.TBLG],

    ["Spawning Pool", blackLandColor],
    ["Peat Bog", blackLandColor],
    ["Subterranean Hangar", blackLandColor],
    ["Bog Wreckage", blackLandColor],
    ["Cabal Pit", blackLandColor],
    ["Cabal Coffers", blackLandColor],
    ["Barren Moor", blackLandColor],
    ["Polluted Mire", blackLandColor],
    ["Everglades", blackLandColor],

    ["Treetop Village", greenLandColor],
    ["Hickory Woodlot", greenLandColor],
    ["Rushwood Grove", greenLandColor],
    ["Centaur Garden", greenLandColor],
    ["Timberland Ruins", greenLandColor],
    ["Tranquil Thicket", greenLandColor],
    ["Slippery Karst", greenLandColor],
    ["Gaea's Cradle", greenLandColor],
    ["Jungle Basin", greenLandColor],

    ["Ghitu Encampment", redLandColor],
    ["Mercadian Bazaar", redLandColor],
    ["Sandstone Needle", redLandColor],
    ["Barbarian Ring", redLandColor],
    ["Ravaged Highlands", redLandColor],
    ["Forgotten Cave", redLandColor],
    ["Smoldering Crater", redLandColor],
    ["Dormant Volcano", redLandColor],

    ["Faerie Conclave", blueLandColor],
    ["Saprazzan Cove", blueLandColor],
    ["Saprazzan Skerry", blueLandColor],
    ["Cephalid Coliseum", blueLandColor],
    ["Seafloor Debris", blueLandColor],
    ["Lonely Sandbar", blueLandColor],
    ["Tolarian Academy", blueLandColor],
    ["Remote Isle", blueLandColor],
    ["Coral Atoll", blueLandColor],

    ["Forbidding Watchtower", whiteLandColor],
    ["Fountain of Cho", whiteLandColor],
    ["Remote Farm", whiteLandColor],
    ["Abandoned Outpost", whiteLandColor],
    ["Nomad Stadium", whiteLandColor],
    ["Secluded Steppe", whiteLandColor],
    ["Drifting Meadow", whiteLandColor],
    ["Serra's Sanctum", whiteLandColor],
    ["Karoo", whiteLandColor],
]);

const dualLandOverrides = new Map<string, [Color, Color]>([
    ["Battlefield Forge", [redLandColor, whiteLandColor]],
    ["Plateau", [redLandColor, whiteLandColor]],

    ["Caves of Koilos", [whiteLandColor, blackLandColor]],
    ["Tainted Field", [whiteLandColor, blackLandColor]],
    ["Scrubland", [blackLandColor, whiteLandColor]],

    ["Llanowar Wastes", [blackLandColor, greenLandColor]],
    ["Tainted Wood", [blackLandColor, greenLandColor]],
    ["Bayou", [blackLandColor, greenLandColor]],

    ["Shivan Reef", [blueLandColor, redLandColor]],
    ["Volcanic Island", [redLandColor, blueLandColor]],

    ["Yavimaya Coast", [greenLandColor, blueLandColor]],
    ["Tropical Island", [blueLandColor, greenLandColor]],

    ["Urborg Volcano", [blackLandColor, redLandColor]],
    ["Shadowblood Ridge", [blackLandColor, redLandColor]],
    ["Tainted Peak", [blackLandColor, redLandColor]],
    ["Bloodstained Mire", [blackLandColor, redLandColor]],
    ["Badlands", [redLandColor, blackLandColor]],

    ["Elfhame Palace", [greenLandColor, whiteLandColor]],
    ["Sungrass Prairie", [greenLandColor, whiteLandColor]],
    ["Windswept Heath", [greenLandColor, whiteLandColor]],
    ["Savannah", [whiteLandColor, greenLandColor]],

    ["Shivan Oasis", [redLandColor, greenLandColor]],
    ["Mossfire Valley", [redLandColor, greenLandColor]],
    ["Wooded Foothills", [redLandColor, greenLandColor]],
    ["Taiga", [redLandColor, greenLandColor]],

    ["Salt Marsh", [blueLandColor, blackLandColor]],
    ["Darkwater Catacombs", [blueLandColor, blackLandColor]],
    ["Tainted Isle", [blueLandColor, blackLandColor]],
    ["Polluted Delta", [blueLandColor, blackLandColor]],
    ["Underground Sea", [blackLandColor, blueLandColor]],

    ["Coastal Tower", [whiteLandColor, blueLandColor]],
    ["Skycloud Expanse", [whiteLandColor, blueLandColor]],
    ["Flooded Strand", [whiteLandColor, blueLandColor]],
    ["Tundra", [whiteLandColor, blueLandColor]],
]);

export function getDefaultTextBoxFill(face: PrintableFace): TextBoxFill {
    return { kind: "solid", color: face.faceColors.tbColor };
}

export function getLandTextBoxFill(face: PrintableFace): TextBoxFill {
    const dual = dualLandOverrides.get(face.name);
    if (dual) {
        // edition === 1 is the original edition where the land was printed, so we use the split color for that edition, and striped for all other editions.
        // edition 0 is the 'book' edition, which is promo cards given when you buy the book, and those are striped as well.
        return face.edition !== 1
            ? { kind: "split", first: dual[0], second: dual[1] }
            : { kind: "striped", colors: dual };
    }

    const mono = monoLandOverrides.get(face.name);
    if (mono) {
        return { kind: "solid", color: mono };
    }

    return {
        kind: "solid",
        color: constants.LandColorByEdition[face.edition] ?? constants.colors.TBLZ,
    };
}

export function getLandBorderColorByEdition(edition: number): Color | undefined {
    return constants.LandBorderColorByEdition[edition];
}