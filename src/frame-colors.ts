import * as constants from "./constants";
import type { Color, PrintableFace } from "./types";

export type TextBoxFill =
    | { kind: "solid"; color: Color }
    | { kind: "split"; first: Color; second: Color }
    | { kind: "striped"; colors: [Color, Color] };

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

    ["Spawning Pool", [156, 153, 140]],
    ["Peat Bog", [156, 153, 140]],
    ["Subterranean Hangar", [156, 153, 140]],
    ["Bog Wreckage", [156, 153, 140]],
    ["Cabal Pit", [156, 153, 140]],
    ["Cabal Coffers", [156, 153, 140]],
    ["Barren Moor", [156, 153, 140]],
    ["Polluted Mire", [156, 153, 140]],
    ["Everglades", [156, 153, 140]],

    ["Treetop Village", [199, 215, 125]],
    ["Hickory Woodlot", [199, 215, 125]],
    ["Rushwood Grove", [199, 215, 125]],
    ["Centaur Garden", [199, 215, 125]],
    ["Timberland Ruins", [199, 215, 125]],
    ["Tranquil Thicket", [199, 215, 125]],
    ["Slippery Karst", [199, 215, 125]],
    ["Gaea's Cradle", [199, 215, 125]],
    ["Jungle Basin", [199, 215, 125]],

    ["Ghitu Encampment", [247, 201, 185]],
    ["Mercadian Bazaar", [247, 201, 185]],
    ["Sandstone Needle", [247, 201, 185]],
    ["Barbarian Ring", [247, 201, 185]],
    ["Ravaged Highlands", [247, 201, 185]],
    ["Forgotten Cave", [247, 201, 185]],
    ["Smoldering Crater", [247, 201, 185]],
    ["Dormant Volcano", [247, 201, 185]],

    ["Faerie Conclave", [180, 206, 215]],
    ["Saprazzan Cove", [180, 206, 215]],
    ["Saprazzan Skerry", [180, 206, 215]],
    ["Cephalid Coliseum", [180, 206, 215]],
    ["Seafloor Debris", [180, 206, 215]],
    ["Lonely Sandbar", [180, 206, 215]],
    ["Tolarian Academy", [180, 206, 215]],
    ["Remote Isle", [180, 206, 215]],
    ["Coral Atoll", [180, 206, 215]],

    ["Forbidding Watchtower", [241, 215, 139]],
    ["Fountain of Cho", [241, 215, 139]],
    ["Remote Farm", [241, 215, 139]],
    ["Abandoned Outpost", [241, 215, 139]],
    ["Nomad Stadium", [241, 215, 139]],
    ["Secluded Steppe", [241, 215, 139]],
    ["Drifting Meadow", [241, 215, 139]],
    ["Serra's Sanctum", [241, 215, 139]],
    ["Karoo", [241, 215, 139]],
]);

const dualLandOverrides = new Map<string, [Color, Color]>([
    ["Battlefield Forge", [[247, 201, 185], [241, 215, 139]]],
    ["Plateau", [[247, 201, 185], [241, 215, 139]]],

    ["Caves of Koilos", [[241, 215, 139], [156, 153, 140]]],
    ["Tainted Field", [[241, 215, 139], [156, 153, 140]]],
    ["Scrubland", [[156, 153, 140], [241, 215, 139]]],

    ["Llanowar Wastes", [[156, 153, 140], [199, 215, 125]]],
    ["Tainted Wood", [[156, 153, 140], [199, 215, 125]]],
    ["Bayou", [[156, 153, 140], [199, 215, 125]]],

    ["Shivan Reef", [[180, 206, 215], [247, 201, 185]]],
    ["Volcanic Island", [[247, 201, 185], [180, 206, 215]]],

    ["Yavimaya Coast", [[199, 215, 125], [180, 206, 215]]],
    ["Tropical Island", [[180, 206, 215], [199, 215, 125]]],

    ["Urborg Volcano", [[156, 153, 140], [247, 201, 185]]],
    ["Shadowblood Ridge", [[156, 153, 140], [247, 201, 185]]],
    ["Tainted Peak", [[156, 153, 140], [247, 201, 185]]],
    ["Bloodstained Mire", [[156, 153, 140], [247, 201, 185]]],
    ["Badlands", [[247, 201, 185], [156, 153, 140]]],

    ["Elfhame Palace", [[199, 215, 125], [241, 215, 139]]],
    ["Sungrass Prairie", [[199, 215, 125], [241, 215, 139]]],
    ["Windswept Heath", [[199, 215, 125], [241, 215, 139]]],
    ["Savannah", [[241, 215, 139], [199, 215, 125]]],

    ["Shivan Oasis", [[247, 201, 185], [199, 215, 125]]],
    ["Mossfire Valley", [[247, 201, 185], [199, 215, 125]]],
    ["Wooded Foothills", [[247, 201, 185], [199, 215, 125]]],
    ["Taiga", [[247, 201, 185], [199, 215, 125]]],

    ["Salt Marsh", [[180, 206, 215], [156, 153, 140]]],
    ["Darkwater Catacombs", [[180, 206, 215], [156, 153, 140]]],
    ["Tainted Isle", [[180, 206, 215], [156, 153, 140]]],
    ["Polluted Delta", [[180, 206, 215], [156, 153, 140]]],
    ["Underground Sea", [[156, 153, 140], [180, 206, 215]]],

    ["Coastal Tower", [[241, 215, 139], [180, 206, 215]]],
    ["Skycloud Expanse", [[241, 215, 139], [180, 206, 215]]],
    ["Flooded Strand", [[241, 215, 139], [180, 206, 215]]],
    ["Tundra", [[241, 215, 139], [180, 206, 215]]],
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