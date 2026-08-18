import "./styles.css";

import * as contants from "./constants";
import * as utils from "./utils";

type card = {
    serial: number;
    edition: string; // Edition abbreviation, e.g., "IN". Not a number in cards.
    name: string;
    face1: number;
    face2: number;
}

type cardFace = {
    faceSerial: number;
    parentCard: number;
    faceType: number;
    edition: number; // Edition number, not abbreviation. This is a number in face-index.dat.
    nameIndex: number;
    manaCostIndex: number;
    typeLineIndex: number;
    powerToughness: number[]; // either empty or has two elements: [power, toughness]
    textLines: number[]; // array of text lines indexes
};

const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const previewElement = document.querySelector<HTMLElement>("#data-preview");
const lookupElement = document.querySelector<HTMLInputElement>("#card-lookup");

const editions: string[] = []; // Will fill from editions.txt
const singleCards: card[] = []; // Will fill from single-cards.txt

const allCardsIndexes: number[] = []; // Will fill from all-cards.txt
const allCardsNames: string[] = []; // Will fill from all-cards.txt

const faceData: cardFace[] = []; // Will fill from face-index.dat
const nameData: string[] = []; // Will fill from face-names.txt
const manaCostData: string[] = []; // Will fill from face-mana.txt
const typeData: string[] = []; // Will fill from face-type-lines.txt
const textData: string[] = []; // Will fill from face-text-lines.txt

const restrictedSubsets: Record<string, string[]> = {}; // Will fill from restricted-subsets.json

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
            }
        }, 300); // 300ms debounce
    });
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

function showCardPreview(query: string): void {
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
        return;
    }
    const serial = allCardsIndexes[matchedIndex];
    const card = singleCards[serial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.
    if (!card) {
        setPreview(`No card found for serial: ${serial}`);
        return;
    }

    let previewText = `Card: ${card.name} (Edition: ${card.edition})`;
    for (let faceNum = 1; faceNum <= 2; faceNum++) {
        const faceSerial = faceNum === 1 ? card.face1 : card.face2;
        if (!faceSerial) {
            // most have only face1 so if face2 is 0, we skip it.
            continue;
        }
        const face = faceData[faceSerial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.
        if (!face) {
            console.warn(`No face found for serial: ${faceSerial}`);
            continue;
        }
        const faceName = nameData[face.nameIndex - 1] || "Unknown";
        const faceEdition = editions[face.edition] || "Unknown"; // ( zero based )
        const faceManaCost = manaCostData[face.manaCostIndex - 1] || "Unknown";
        const faceTypeLine = typeData[face.typeLineIndex - 1] || "Unknown";
        const facePowerToughness = face.powerToughness.length === 2 ? `${face.powerToughness[0]}/${face.powerToughness[1]}` : "N/A";

        const faceTextLines = face.textLines.map(index => textData[index - 1]?.replaceAll('<this>', faceName) || "").filter(line => line !== "").join("\n");

        previewText += `
            ---------------
            Face ${faceNum}:
            Name: ${faceName}
            Mana Cost: ${faceManaCost}
            Type Line: ${faceTypeLine}
            Edition: ${faceEdition}  
            Power/Toughness: ${facePowerToughness}
            Text:
            ${faceTextLines}`;


    }

    // Remove spaces before each newline in the previewText for better formatting
    previewText = previewText.replace(/^\s+/gm, '');
    setPreview(previewText);
}


async function bootstrap(): Promise<void> {

    console.log(`Project ${utils.formatBootstrapMessage(contants.APP_NAME)} with accent ${contants.SAMPLE_THEME.accentColor}.`);

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
            const hasPT = new DataView(arrayBuffer, pointer, 4).getUint32(0, true);
            pointer += 4;
            let powerToughness: number[] = [];
            if (hasPT) {
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
                powerToughness,
                textLines
            });
        }

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

        setStatus("Data loaded successfully.");
        console.log("Data loaded successfully. Total cards:", singleCards.length, 'Card names:', allCardsNames.length, "Total faces:", faceData.length);



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