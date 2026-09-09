import * as constants from "./constants";
import type { Card, CardFace, Color, PrintableFace } from "./types";

export type CardDatabaseStats = {
    totalCards: number;
    totalCardNames: number;
    totalFaces: number;
};

// Loads and parses every static data file the app needs, then serves typed lookups over it.
export class CardDatabase {
    private editionsList: string[] = [];
    private editionsScryData: Record<string, { "scry": string[], "name": string }> = {};
    private singleCardsData: Card[] = [];

    private allCardsIndexes: number[] = [];
    private allCardsNames: string[] = [];

    private faceData: CardFace[] = [];
    private nameData: string[] = [];
    private manaCostData: string[] = [];
    private typeData: string[] = [];
    private textData: string[] = [];
    private artistsData: string[] = [];

    private restrictedSubsetsData: Record<string, string[]> = {};

    get editions(): readonly string[] {
        return this.editionsList;
    }

    get editionsScry(): Readonly<Record<string, { "scry": string[], "name": string }>> {
        return this.editionsScryData;
    }

    get singleCards(): readonly Card[] {
        return this.singleCardsData;
    }

    get restrictedSubsets(): Readonly<Record<string, string[]>> {
        return this.restrictedSubsetsData;
    }

    get stats(): CardDatabaseStats {
        return {
            totalCards: this.singleCardsData.length,
            totalCardNames: this.allCardsNames.length,
            totalFaces: this.faceData.length,
        };
    }

    async load(): Promise<void> {
        this.nameData.push(...parseTextData(await fetchText("face-names.txt")));
        this.manaCostData.push(...parseTextData(await fetchText("face-mana.txt")));
        this.typeData.push(...parseTextData(await fetchText("face-type-lines.txt")));
        this.textData.push(...parseTextData(await fetchText("face-text-lines.txt")));
        this.artistsData.push(...parseTextData(await fetchText("artists.txt")));

        Object.assign(this.editionsScryData, JSON.parse(await fetchText("editions.json")));
        for (const key in this.editionsScryData) {
            if (this.editionsScryData.hasOwnProperty(key)) {
                this.editionsList.push(key); // Build editions with the keys from editionsScry
            }
        }

        const allCardsLines = parseTextData(await fetchText("all-cards.txt"));
        for (const line of allCardsLines) {
            const parts = line.split(",");
            if (parts.length < 2) {
                throw new Error(`Malformed line in all-cards.txt: ${line}`);
            }
            const name = parts.slice(1).join(",").trim().toLowerCase();
            const serial = parseInt(parts[0].trim(), 10);
            this.allCardsIndexes.push(serial);
            this.allCardsNames.push(name);
        }

        this.singleCardsData.push(...parseSingleCards(await fetchText("single-cards.txt")));

        const totalFaces = this.singleCardsData[this.singleCardsData.length - 1].face2
            || this.singleCardsData[this.singleCardsData.length - 1].face1;
        // Assuming the last card has the highest face number. face 2 is often 0 if the card has only one face, so we take face1 if face2 is 0.

        const faceIndexResponse = await fetch("face-index.dat");
        if (!faceIndexResponse.ok) {
            throw new Error(`HTTP ${faceIndexResponse.status}`);
        }
        const arrayBuffer = await faceIndexResponse.arrayBuffer();
        this.faceData.push(...parseFaceIndexBuffer(arrayBuffer, totalFaces));

        const parsedRestrictedSubsets = JSON.parse(await fetchText("restricted-subsets.json"));
        if (typeof parsedRestrictedSubsets !== "object" || parsedRestrictedSubsets === null) {
            throw new Error("Invalid JSON structure in restricted-subsets.json. Expected an object.");
        }
        for (const [key, value] of Object.entries(parsedRestrictedSubsets)) {
            if (Array.isArray(value) && value.every(item => typeof item === "string")) {
                this.restrictedSubsetsData[key] = value;
            } else {
                throw new Error(`Invalid value for key ${key} in restricted-subsets.json. Expected an array of strings.`);
            }
        }
    }

    // Serials are 1-based, array indexes are 0-based; this is the single place that adjusts for it.
    getCardBySerial(serial: number): Card {
        return this.singleCardsData[serial - 1];
    }

    // Case-insensitive prefix search over the lowercased card-name index; returns the matching card's serial.
    findCardSerialByNamePrefix(query: string): number | undefined {
        const matchedIndex = this.allCardsNames.findIndex(name => name.startsWith(query));
        return matchedIndex === -1 ? undefined : this.allCardsIndexes[matchedIndex];
    }

    getFaceData(cardSerial: number): [PrintableFace, PrintableFace | undefined] {
        const card = this.getCardBySerial(cardSerial);
        const artist = this.artistsData[card.artist];

        const face1 = this.getPrintableFace(card.face1, undefined, artist);
        if (!card.face2 || card.face2 === 0) {
            return [face1, undefined];
        }
        const face2 = this.getPrintableFace(card.face2, face1, artist); // pass face 1 in case its flip cards and other side needs color info. (no casting cost on flip side, so we need to know the color from the other side.)

        return [face1, face2];
    }

    private getPrintableFace(faceSerial: number, otherFace: PrintableFace | undefined, artist: string): PrintableFace {
        const face = this.faceData[faceSerial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.

        // About FaceFrame
        // Find it with Manacost, 0=is a land.
        // If manacost = {0} & it IS a creature, then FaceFrame=frameR
        let faceFrame: number;

        let colorState = 0;
        let faceColors: { frameColor: Color; tbColor: Color };
        const manaCost = this.manaCostData[face.manaCostIndex - 1] || "";

        if (manaCost.includes("G")) colorState += 1;
        if (manaCost.includes("R")) colorState += 2;
        if (manaCost.includes("B")) colorState += 4;
        if (manaCost.includes("U")) colorState += 8;
        if (manaCost.includes("W")) colorState += 16;

        switch (colorState) {
            case 0:
                faceFrame = constants.frame.frameA;
                faceColors = {
                    frameColor: constants.colors.FA,
                    tbColor: constants.colors.TBA
                };
                break;
            case 1:
                faceFrame = constants.frame.frameG;
                faceColors = {
                    frameColor: constants.colors.FG,
                    tbColor: constants.colors.TBG
                };
                break;
            case 2:
                faceFrame = constants.frame.frameR;
                faceColors = {
                    frameColor: constants.colors.FR,
                    tbColor: constants.colors.TBR
                };
                break;
            case 4:
                faceFrame = constants.frame.frameB;
                faceColors = {
                    frameColor: constants.colors.FB,
                    tbColor: constants.colors.TBB
                };
                break;
            case 8:
                faceFrame = constants.frame.frameU;
                faceColors = {
                    frameColor: constants.colors.FU,
                    tbColor: constants.colors.TBU
                };
                break;
            case 16:
                faceFrame = constants.frame.frameW;
                faceColors = {
                    frameColor: constants.colors.FW,
                    tbColor: constants.colors.TBW
                };
                break;
            default:
                faceFrame = constants.frame.frameZ;
                faceColors = {
                    frameColor: constants.colors.FZ,
                    tbColor: constants.colors.TBZ
                };
        }
        if (manaCost === "") {
            faceFrame = constants.frame.frameL;
            faceColors = {
                frameColor: constants.colors.FL,
                tbColor: constants.colors.TBLZ
            };
        }

        const typeLine = this.typeData[face.typeLineIndex - 1] || "";
        if (colorState === 0 && face.isACreature && !typeLine.includes("Artifact")) {
            faceFrame = constants.frame.frameR;
            faceColors = {
                frameColor: constants.colors.FR,
                tbColor: constants.colors.TBR
            };
            colorState = 2;
        }

        // If this was the last side of a flip card, we need to set the faceFrame, and colorState, and faceColors to match the other side of the flip card.
        if (face.faceType === 3 && otherFace) {
            faceFrame = otherFace.faceFrame;
            faceColors = otherFace.faceColors;
            colorState = otherFace.colorState;
        }

        return {
            serial: faceSerial,
            faceLayout: face.faceType,

            name: this.nameData[face.nameIndex - 1],
            manaCost: this.manaCostData[face.manaCostIndex - 1],
            typeLine: this.typeData[face.typeLineIndex - 1],
            edition: face.edition,
            isACreature: face.isACreature,
            powerToughness: face.isACreature ? `${face.powerToughness[0]}/${face.powerToughness[1]}` : "",
            textLines: face.textLines.map(index => this.textData[index - 1]?.replaceAll('<this>', this.nameData[face.nameIndex - 1]) || "").filter(line => line !== ""),
            colorState: colorState,
            faceFrame: faceFrame,
            faceColors: faceColors,
            artist: artist,
        };
    }
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
}

function parseTextData(rawText: string): string[] {
    const lines = rawText.split(/\r?\n/);
    const result: string[] = [];

    // first line should be the number total of entries.
    const totalEntries = parseInt(lines[0], 10);
    for (let i = 1; i <= totalEntries; i++) {
        // If we get a single dot '.', it means we are done with the text lines.
        if (lines[i] === ".") {
            break;
        }
        result.push(lines[i]);
    }
    // Verify that the number of lines read matches the expected total entries.
    if (result.length !== totalEntries) {
        throw new Error(`Mismatch in expected text lines: expected ${totalEntries}, got ${result.length}.`);
    }

    return result;
}

function parseSingleCards(rawText: string): Card[] {
    const lines = rawText.split(/\r?\n/);
    const result: Card[] = [];
    // single-cards.txt does not have a total count lines, but it ends with a single dot '.' on a line by itself.
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === ".") {
            break;
        }
        // lines look like this:
        // 4174, 4174, 0, IN, Greg Staples, d/5/d5eef49c-a80f-4622-ba77-999f9151c841.jpg?1783945666, Artifact Mutation
        const parts = lines[i].split(",");
        if (parts.length < 5) {
            throw new Error(`Malformed line in single-cards.txt: ${lines[i]}`);
        }
        const serial = parseInt(parts[0].trim(), 10);
        const face1 = parseInt(parts[1].trim(), 10);
        const face2 = parseInt(parts[2].trim(), 10);
        const edition = parts[3].trim();
        const artist = parseInt(parts[4].trim(), 10);
        const url = parts[5].trim();
        const name = parts.slice(6).join(",").trim();

        result.push({ serial, face1, face2, edition, name, artist, url });
    }

    return result;
}

function parseFaceIndexBuffer(arrayBuffer: ArrayBuffer, totalFaces: number): CardFace[] {
    const faces: CardFace[] = [];
    let pointer = 0;
    for (let i = 0; i < totalFaces; i++) {
        const faceSerial = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const parentCard = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const faceType = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const edition = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const nameIndex = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const manaCostIndex = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const typeLineIndex = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const isACreature = new DataView(arrayBuffer, pointer, 4).getUint32(0, true) !== 0;
        pointer += 4;
        let powerToughness: number[] = [];
        if (isACreature) {
            const power = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
            pointer += 4;
            const toughness = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
            pointer += 4;
            powerToughness = [power, toughness];
        }
        const numText = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
        pointer += 4;
        const textLines: number[] = [];
        for (let j = 0; j < numText; j++) {
            const textIndex = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
            pointer += 4;
            textLines.push(textIndex);
        }

        faces.push({
            faceSerial,
            parentCard,
            faceType,
            edition,
            nameIndex,
            manaCostIndex,
            typeLineIndex,
            isACreature,
            powerToughness,
            textLines
        });
    }

    return faces;
}
