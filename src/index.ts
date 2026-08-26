import "./styles.css";

import { loadFaceArtForCard } from "./art-loader";
import * as constants from "./constants";
import type { card, cardFace, Color, PrintableFace } from "./types";
import { renderCardPreview } from "./renderer";
import * as utils from "./utils";

const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const previewElement = document.querySelector<HTMLElement>("#data-preview");
const lookupElement = document.querySelector<HTMLInputElement>("#card-lookup");

const editions: string[] = []; // Will fill from editions.txt
const editionsScry: Record<string, string[]> = {}; // Will fill from editions-scry.json
const singleCards: card[] = []; // Will fill from single-cards.txt

const allCardsIndexes: number[] = []; // Will fill from all-cards.txt
const allCardsNames: string[] = []; // Will fill from all-cards.txt

const faceData: cardFace[] = []; // Will fill from face-index.dat
const nameData: string[] = []; // Will fill from face-names.txt
const manaCostData: string[] = []; // Will fill from face-mana.txt
const typeData: string[] = []; // Will fill from face-type-lines.txt
const textData: string[] = []; // Will fill from face-text-lines.txt

const restrictedSubsets: Record<string, string[]> = {}; // Will fill from restricted-subsets.json

const canvasElement = document.querySelector<HTMLCanvasElement>("#card-preview");
let renderedFaceArt = new Map<number, ImageBitmap>();

// Add a listener to the lookup input field to handle card name lookups, debounced to avoid excessive processing.
if (lookupElement) {
    let debounceTimeout: number | undefined;
    lookupElement.addEventListener("input", () => {
        if (faceData.length === 0 || singleCards.length === 0) {
            return;
        }
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = window.setTimeout(() => {
            const query = lookupElement.value.trim().toLowerCase();
            if (query) {
                showCardPreview(query);
            } else {
                setPreview("Please enter a card name to look up.");
                // Clear the canvas 
                utils.clearCanvas(canvasElement);
            }
        }, 300); // 300ms debounce
    });
}

function getFaceData(cardSerial: number): [PrintableFace, PrintableFace | undefined] {

    const card = singleCards[cardSerial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.

    const face1 = getPrintableFace(card.face1);
    if (!card.face2 || card.face2 === 0) {
        return [face1, undefined];
    }
    const face2 = getPrintableFace(card.face2, face1); // pass face 1 in case its flip cards and other side needs color info. (no casting cost on flip side, so we need to know the color from the other side.)

    return [face1, face2];

}

function getPrintableFace(faceSerial: number, otherFace?: PrintableFace): PrintableFace {
    const face = faceData[faceSerial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.

    // About FaceFrame
    // Find it with Manacost, 0=is a land.
    // If manacost = {0} & it IS a creature, then FaceFrame=frameR
    let faceFrame: number;

    let colorState = 0;
    let faceColors: { frameColor: Color; tbColor: Color };
    const manaCost = manaCostData[face.manaCostIndex - 1] || "";

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

    const typeLine = typeData[face.typeLineIndex - 1] || "";
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

        name: nameData[face.nameIndex - 1],
        manaCost: manaCostData[face.manaCostIndex - 1],
        typeLine: typeData[face.typeLineIndex - 1],
        edition: face.edition,
        isACreature: face.isACreature,
        powerToughness: face.isACreature ? `${face.powerToughness[0]}/${face.powerToughness[1]}` : "",
        textLines: face.textLines.map(index => textData[index - 1]?.replaceAll('<this>', nameData[face.nameIndex - 1]) || "").filter(line => line !== ""),
        colorState: colorState,
        faceFrame: faceFrame,
        faceColors: faceColors

    };
}

function setStatus(message: string): void {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function setPreview(message: string): void {
    if (previewElement) {
        previewElement.textContent = message;
    }
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

function parseEditions(rawText: string): string[] {
    // Editions data is expected to be a list of editions abbreviations, one per line, with no total count line. 
    // The list ends with a single dot '.' on a line by itself.

    const lines = rawText.split(/\r?\n/);
    const result: string[] = [];

    const totalEntries = lines.length;
    for (let i = 0; i < totalEntries; i++) {
        // If we get a single dot '.', it means we are done with the text lines.
        if (lines[i] === ".") {
            break;
        }
        result.push(lines[i]);
    }

    return result;
}

function parseSingleCards(rawText: string): card[] {
    const lines = rawText.split(/\r?\n/);
    const result: card[] = [];
    // single-cards.txt does not have a total count lines, but it ends with a single dot '.' on a line by itself.
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === ".") {
            break;
        }
        // lines look like this:
        // 4174, 4174, 0, IN, Artifact Mutation
        const parts = lines[i].split(",");
        if (parts.length < 5) {
            console.warn(`Skipping malformed line: ${lines[i]}`);
            throw new Error(`Malformed line in single-cards.txt: ${lines[i]}`);
        }
        const serial = parseInt(parts[0].trim(), 10);
        const face1 = parseInt(parts[1].trim(), 10);
        const face2 = parseInt(parts[2].trim(), 10);
        const edition = parts[3].trim();
        const name = parts.slice(4).join(",").trim();

        result.push({ serial, face1, face2, edition, name });
    }

    return result;
}

async function showCardPreview(query: string): Promise<void> {
    // try to match the first that startswith the query, case insensitive
    // from the allCardsDict dictionary, which maps lowercased card names to serial numbers.
    // then that index can be used with singleCards to get the card data, and then with faceData to get the face data.
    let matchedIndex = -1;
    for (let i = 0; i < allCardsNames.length; i++) {
        if (allCardsNames[i].startsWith(query)) {
            matchedIndex = i;
            break;
        }
    }

    if (matchedIndex === -1) {
        setPreview(`No card found starting with "${query}".`);
        // Clear the canvas!
        utils.clearCanvas(canvasElement);
        return;
    }
    const serial = allCardsIndexes[matchedIndex];
    const card = singleCards[serial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.
    if (!card) {
        setPreview(`No card found for serial: ${serial}`);
        return;
    }

    // Get getFaceData, the faces are one or two printable faces witch can be on the surface of the card. 
    // The first face is always present, the second face may be undefined if the card has only one face.
    const faces = getFaceData(serial);

    // Now we have the card, we can get its face data. Then we can resolve any cached or fetched face art.
    const cardName = card.name;
    const possibleCardEditions = editionsScry[card.edition];
    if (!possibleCardEditions || possibleCardEditions.length === 0) {
        throw new Error(`No editions found for card: ${cardName} (edition: ${card.edition})`);
    }

    console.log(`Card found: ${cardName} (possible editions: ${possibleCardEditions?.join(", ")})`);

    releaseRenderedFaceArt();

    try {
        renderedFaceArt = await loadFaceArtForCard({
            card,
            faces,
            scryfallEditions: possibleCardEditions,
        });
    } catch (error) {
        console.error(`Error fetching card data for ${cardName}:`, error);
    }

    if (!canvasElement) {
        return;
    }
    const context = canvasElement.getContext("2d");
    if (!context) {
        return;
    }

    // Now it's finally time to render the card preview on the canvas. We'll use the renderCardPreview function for this.
    renderCardPreview(context, faces, {
        padding: 20,
        background: "#f3ecdf",
        artByFaceSerial: renderedFaceArt,
    });

    // And to complete the preview, let's also show the card name, edition, and face details in the preview text area.
    let previewText = `Card: ${card.name} (Edition: ${card.edition})`;
    for (const face of faces) {
        if (!face) {
            continue;
        }
        const faceName = face.name || "Unknown";
        const faceEdition = editions[face.edition] || "Unknown"; // ( zero based )
        const faceManaCost = face.manaCost || "Unknown";
        const faceTypeLine = face.typeLine || "Unknown";
        const facePowerToughness = face.isACreature ? `${face.powerToughness}` : "N/A";
        const faceTextLines = face.textLines.join("\n");

        previewText += `
            ---------------
            Face ${face.serial}:
            Name: ${faceName}
            Mana Cost: ${faceManaCost}
            Type Line: ${faceTypeLine}
            Edition: ${faceEdition}  
            Power/Toughness: ${facePowerToughness}
            Text:
            ${faceTextLines}`;
    }
    previewText = previewText.replace(/^\s+/gm, ''); // Remove spaces before newlines for better formatting
    setPreview(previewText);

}

function releaseRenderedFaceArt(): void {
    for (const artBitmap of renderedFaceArt.values()) {
        artBitmap.close();
    }

    renderedFaceArt = new Map<number, ImageBitmap>();
}


async function bootstrap(): Promise<void> {

    if (lookupElement) {
        requestAnimationFrame(() => {
            lookupElement.focus();
        });
    }

    try {

        let response = await fetch("face-names.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        let text = await response.text();
        nameData.push(...parseTextData(text));

        response = await fetch("face-mana.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        manaCostData.push(...parseTextData(text));

        response = await fetch("face-type-lines.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        typeData.push(...parseTextData(text));

        response = await fetch("face-text-lines.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        textData.push(...parseTextData(text));

        // Fetch editions.txt and parse it
        response = await fetch("editions.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        editions.push(...parseEditions(text));

        // Fetch editions-scry.json and parse it
        response = await fetch("editions-scry.json");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        Object.assign(editionsScry, JSON.parse(text));

        // Fetch all-cards.txt and parse it to fill up allCardsDict
        response = await fetch("all-cards.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        const allCardsLines = parseTextData(text);
        for (const line of allCardsLines) {
            const parts = line.split(",");
            if (parts.length < 2) {
                console.warn(`Skipping malformed line in all-cards.txt: ${line}`);
                throw new Error(`Malformed line in all-cards.txt: ${line}`);
            }
            const name = parts.slice(1).join(",").trim().toLowerCase();
            const serial = parseInt(parts[0].trim(), 10);
            allCardsIndexes.push(serial);
            allCardsNames.push(name);
        }

        // Fetch single-cards.txt and parse it
        response = await fetch("single-cards.txt");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        singleCards.push(...parseSingleCards(text));

        const totalFaces = singleCards[singleCards.length - 1].face2 || singleCards[singleCards.length - 1].face1;
        // Assuming the last card has the highest face number. face 2 is often 0 if the card has only one face, so we take face1 if face2 is 0.

        response = await fetch("face-index.dat");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Let's build faceData from the arrayBuffer. assuming the old basic code structure, 
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

            faceData.push({
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
        // faceData is filled with all face data from face-index.dat and is ready for rendering.

        // Now load the restrictedSubsets which is json 
        response = await fetch("restricted-subsets.json");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const jsonText = await response.text();
        try {
            const parsedJson = JSON.parse(jsonText);
            if (typeof parsedJson === "object" && parsedJson !== null) {
                for (const [key, value] of Object.entries(parsedJson)) {
                    if (Array.isArray(value) && value.every(item => typeof item === "string")) {
                        restrictedSubsets[key] = value;
                    } else {
                        throw new Error(`Invalid value for key ${key} in restricted-subsets.json. Expected an array of strings.`);
                    }
                }
            } else {
                throw new Error(`Invalid JSON structure in restricted-subsets.json. Expected an object.`);
            }
        } catch (error) {
            throw new Error(`Failed to parse restricted-subsets.json: ${error}`);
        }

        setStatus(`Total cards: ${singleCards.length}, Card names: ${allCardsNames.length}, Total faces: ${faceData.length}`);




    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus("Fetch failed.");
        setPreview(
            [
                "Could not load a file.",
                "That usually means webpack is not copying the file into dist.",
                `Error: ${message}`
            ].join("\n")
        );
    }



}

void bootstrap();