import "./styles.css";

import { loadFaceArtForCard, prepareFaceArtForCard } from "./art-loader";
import {
    clearCachedFaceArt,
    exportCachedFaceArt,
    getCachedFaceArtCount,
    importCachedFaceArt
} from "./art-cache";
import * as constants from "./constants";
import { buildEditionCheckboxes } from "./edition-filter";
import type { Card, CardFace, Color, PrintableFace } from "./types";
import { renderCardPreview } from "./renderer";
import * as utils from "./utils";

const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const lookupElement = document.querySelector<HTMLInputElement>("#card-lookup");
const clearArtCacheButton = document.querySelector<HTMLButtonElement>("#clear-art-cache");
const exportArtCacheButton = document.querySelector<HTMLButtonElement>("#export-art-cache");
const importArtCacheButton = document.querySelector<HTMLButtonElement>("#import-art-cache")
const generatePdfButton = document.querySelector<HTMLButtonElement>("#generate-deck-pdf");
const importArtCacheFileInput = document.querySelector<HTMLInputElement>("#import-art-cache-file");
const editionCheckboxesContainer = document.querySelector<HTMLElement>("#edition-checkboxes");
const decklistTextArea = document.querySelector<HTMLTextAreaElement>("#decklist-text");
const decklistPaperSizeSelect = document.querySelector<HTMLSelectElement>("#decklist-paper-size"); // For future use
const loadDecklistButton = document.querySelector<HTMLButtonElement>("#load-decklist");
const saveDecklistButton = document.querySelector<HTMLButtonElement>("#save-decklist");
const clearDecklistButton = document.querySelector<HTMLButtonElement>("#clear-decklist");
const loadDecklistFileInput = document.querySelector<HTMLInputElement>("#load-decklist-file");
const addToDecklistButton = document.querySelector<HTMLButtonElement>("#add-to-decklist");
const addP9ToDecklistButton = document.querySelector<HTMLButtonElement>("#add-p9-to-decklist");
const deckTabButtons = document.querySelectorAll<HTMLButtonElement>(".deck-tab");
const deckPanels: Record<string, HTMLElement | null> = {
    constructed: document.querySelector<HTMLElement>("#deck-panel-constructed"),
    sealed: document.querySelector<HTMLElement>("#deck-panel-sealed"),
};
let activeDeckTab: "constructed" | "sealed" = "constructed";
let editionSelection: Record<string, boolean> = {};

const editions: string[] = []; // Will fill from editions.txt
const editionsScry: Record<string, string[]> = {}; // Will fill from editions-scry.json
const singleCards: Card[] = []; // Will fill from single-cards.txt

const allCardsIndexes: number[] = []; // Will fill from all-cards.txt
const allCardsNames: string[] = []; // Will fill from all-cards.txt

const faceData: CardFace[] = []; // Will fill from face-index.dat
const nameData: string[] = []; // Will fill from face-names.txt
const manaCostData: string[] = []; // Will fill from face-mana.txt
const typeData: string[] = []; // Will fill from face-type-lines.txt
const textData: string[] = []; // Will fill from face-text-lines.txt

const restrictedSubsets: Record<string, string[]> = {}; // Will fill from restricted-subsets.json
const artData: Record<string, { a: string; b: string }> = {}; // Will fill from reduced-default-cards.json

const canvasElement = document.querySelector<HTMLCanvasElement>("#card-preview");
let renderedFaceArt = new Map<number, ImageBitmap>();
let currentPreviewState: {
    card: Card;
    faces: [PrintableFace, PrintableFace | undefined];
} | null = null;
let statusSummary = {
    totalCards: 0,
    totalCardNames: 0,
    totalFaces: 0,
};

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
        debounceTimeout = window.setTimeout(async () => {
            let query = lookupElement.value.trim().toLowerCase();

            // replace accented letters by their plain lowercase version
            query = query.normalize("NFD").replace(/\p{M}/gu, "");
            // Remove any quotes
            query = query.replace(/"/g, "");

            if (query) {
                try {
                    await showCardPreview(query);
                    await updateStatusSummary();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    setStatus(`Failed to show card preview: ${message}`);
                    clearCurrentPreviewState();
                    setPreview("Failed to show card preview.");
                    utils.clearCanvas(canvasElement);
                }
            } else {
                clearCurrentPreviewState();
                setPreview("Please enter a card name to look up.");
                await updateStatusSummary();
                // Clear the canvas 
                utils.clearCanvas(canvasElement);
            }
        }, 300); // 300ms debounce
    });
}

if (generatePdfButton) {
    generatePdfButton.addEventListener("click", async () => {

        // Two modes of this app: Sealed deck and constructed deck PDF generation

        if (activeDeckTab === "sealed") {
            await generateSealedPDF();
        } else {
            await generateDeckPDF();
        }

    });
}

if (deckTabButtons.length > 0) {
    deckTabButtons.forEach(tabButton => {
        tabButton.addEventListener("click", () => {
            const tab = tabButton.dataset.deckTab;
            if (tab !== "constructed" && tab !== "sealed") {
                return;
            }
            activeDeckTab = tab;

            deckTabButtons.forEach(button => {
                button.classList.toggle("active", button === tabButton);
            });

            for (const [panelTab, panelElement] of Object.entries(deckPanels)) {
                if (panelElement) {
                    panelElement.hidden = panelTab !== tab;
                }
            }

            syncGeneratePdfButton();
        });
    });
}

if (decklistTextArea) {
    decklistTextArea.addEventListener("input", () => {
        syncGeneratePdfButton();
    });
}

if (loadDecklistButton && loadDecklistFileInput) {
    loadDecklistButton.addEventListener("click", () => {
        loadDecklistFileInput.click();
    });

    loadDecklistFileInput.addEventListener("change", async () => {
        const file = loadDecklistFileInput.files?.[0];
        loadDecklistFileInput.value = "";

        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            if (decklistTextArea) {
                decklistTextArea.value = text;
                syncGeneratePdfButton();
            }
            setStatus(`Loaded decklist from ${file.name}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Failed to load decklist: ${message}`);
        }
    });
}

if (saveDecklistButton) {
    saveDecklistButton.addEventListener("click", () => {
        const text = decklistTextArea?.value ?? "";
        downloadDecklist(text);
        setStatus("Decklist saved.");
    });
}

if (clearDecklistButton) {
    clearDecklistButton.addEventListener("click", () => {
        if (decklistTextArea) {
            decklistTextArea.value = "";
            syncGeneratePdfButton();
        }
    });
}

if (addToDecklistButton) {
    addToDecklistButton.addEventListener("click", () => {
        if (!currentPreviewState || !decklistTextArea) {
            return;
        }

        const existingText = decklistTextArea.value;
        const separator = existingText.length > 0 && !existingText.endsWith("\n") ? "\n" : "";
        decklistTextArea.value = `${existingText}${separator}${currentPreviewState.card.name}\n`;
        syncGeneratePdfButton();
    });
}

if (addP9ToDecklistButton) {
    addP9ToDecklistButton.addEventListener("click", () => {
        if (!decklistTextArea) {
            return;
        }

        const existingText = decklistTextArea.value;
        const separator = existingText.length > 0 && !existingText.endsWith("\n") ? "\n" : "";
        const power9Cards = [
            "Time Walk",
            "Ancestral Recall",
            "Timetwister",
            "Mox Emerald",
            "Black Lotus",
            "Mox Pearl",
            "Mox Ruby",
            "Mox Jet",
            "Mox Sapphire",
        ];
        decklistTextArea.value = `${existingText}${separator}${power9Cards.join("\n")}\n`;
        syncGeneratePdfButton();
    });
}


if (clearArtCacheButton) {
    clearArtCacheButton.addEventListener("click", async () => {
        if (!window.confirm("Clear all cached art images from IndexedDB?")) {
            return;
        }

        try {
            await clearCachedFaceArt();
            await updateStatusSummary("Art cache cleared.");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Failed to clear art cache: ${message}`);
        }
    });
}

if (exportArtCacheButton) {
    exportArtCacheButton.addEventListener("click", async () => {
        try {
            const exportBlob = await exportCachedFaceArt();
            downloadArtCacheExport(exportBlob);
            await updateStatusSummary("Art cache exported.");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Failed to export art cache: ${message}`);
        }
    });
}

if (importArtCacheButton && importArtCacheFileInput) {
    importArtCacheButton.addEventListener("click", () => {
        importArtCacheFileInput.click();
    });

    importArtCacheFileInput.addEventListener("change", async () => {
        const file = importArtCacheFileInput.files?.[0];
        importArtCacheFileInput.value = "";

        if (!file) {
            return;
        }

        try {
            const result = await importCachedFaceArt(file);
            await updateStatusSummary(`Imported ${result.importedCount} art images.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Failed to import art cache: ${message}`);
        }
    });
}

async function preloadCardArtForCards(cards: Card[]): Promise<void> {
    for (const card of cards) {

        const serial = card.serial;

        const faces = getFaceData(serial);
        const possibleCardEditions = editionsScry[card.edition];

        await prepareFaceArtForCard({
            card,
            faces,
            scryfallEditions: possibleCardEditions,
        }, artData);
        console.log(`Preloaded art for card: ${card.name}`);
    }
}


async function generateSealedPDF(): Promise<void> {
    const selectedEditions = Object.entries(editionSelection)
        .filter(([, checked]) => checked)
        .map(([code]) => code);
    console.log("Selected editions for sealed deck:", selectedEditions);

    // Let's build an array of available cards by looping singleCards and making sure its edition is selected.
    // And that the card is not a basic land.
    const availableCards = singleCards.filter(card => selectedEditions.includes(card.edition) && !constants.BasicLandNames.includes(card.name));
    // Convert it to a dict, with the card name as the key for easy lookup. Keeping the first occurrence if there are duplicates.
    const availableCardsDict: Record<string, typeof singleCards[0]> = {};
    for (const card of availableCards) {
        if (!availableCardsDict[card.name]) {
            availableCardsDict[card.name] = card;
        }
    }
    // Console log the total of available cards and the total of unique available cards.
    console.log(`Total available cards without basic lands: ${availableCards.length}`);

    const totalUniqueAvailableCards = Object.keys(availableCardsDict).length;
    console.log(`Total unique available cards without basic lands: ${totalUniqueAvailableCards}`);

    // A sealed deck is here set to be a total of 81 cards. (nine sheets of 3 by 3 cards each)
    const sealedDeckSize = 81; // nine sheets of 3 by 3 cards each
    const sealedDeckCards: Card[] = [];

    // Fill the sealed deck with random cards from the available cards in totalUniqueAvailableCards.
    const availableCardPool = Object.values(availableCardsDict);
    if (availableCardPool.length === 0 || !generatePdfButton) {
        setStatus("No cards are available for the selected editions.");
        return;
    }

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating PDF...";


    while (sealedDeckCards.length < sealedDeckSize) {
        const randomIndex = Math.floor(Math.random() * availableCardPool.length);
        sealedDeckCards.push(availableCardPool[randomIndex]);
    }

    console.log(`Generated sealed deck with ${sealedDeckCards.length} cards. Papersize is ${decklistPaperSizeSelect?.value}`);
    console.log("Sealed deck cards:", sealedDeckCards);

    // TODO : fetch any missing card art from local cache, and send to a function that generates a PDF for the sealed deck taking into account the decklistPaperSizeSelect choice.

    try {

        console.log("Generating PDF for sealed deck...");
        await preloadCardArtForCards(sealedDeckCards);


    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.disabled = false;
        generatePdfButton.textContent = originalLabel;
        syncGeneratePdfButton();
        await updateStatusSummary();
    }

}

async function generateDeckPDF(): Promise<void> {

    if (!generatePdfButton) {
        return;
    }

    console.log(`Selected decklist paper size: ${decklistPaperSizeSelect?.value}`);

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating PDF...";

    // 1 : cleanup decklistTextArea's content in a nice string array.
    const cleanedDecklist = decklistTextArea?.value
        .split(/\r?\n/)
        // also remove any quotes
        .map(line => line.replace(/"/g, ""))
        .map(line => line.trim().replace(/^[\s,]+|[\s,]+$/g, ""))
        // also replace accented letters with their non-accented counterparts
        .map(line => line.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
        // also lowercase the line for consistency
        .map(line => line.toLowerCase())
        .filter(line => line.length > 0);

    // 2 : Now if any of those lines start with a number followed by "x" (e.g., "3x"), we can interpret that as a quantity for the card in the decklist.
    const decklistWithQuantities = cleanedDecklist?.map(line => {
        const match = line.match(/^(\d+)x\s*(.*)$/i);
        if (match) {
            return { quantity: parseInt(match[1], 10), cardName: match[2] };
        }
        return { quantity: 1, cardName: line };
    });

    console.log("Decklist with quantities:", decklistWithQuantities);

    const decklistCards: Card[] = [];

    for (const { quantity, cardName } of decklistWithQuantities ?? []) {
        console.log(`Card: ${cardName}, Quantity: ${quantity}`);
        let matchedIndex = -1;
        for (let i = 0; i < allCardsNames.length; i++) {
            if (allCardsNames[i].startsWith(cardName)) {
                matchedIndex = i;
                break;
            }
        }

        if (matchedIndex === -1) {
            console.log(`No card found starting with "${cardName}".`);
        } else {
            console.log(`Matched card index for "${cardName}": ${matchedIndex}`);
            const serial = allCardsIndexes[matchedIndex];
            const card = singleCards[serial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.

            for (let i = 0; i < quantity; i++) {
                decklistCards.push(card);
            }
        }
    }

    console.log("Consolidated decklist cards:", decklistCards);

    // TODO : fetch any missing card art from local cache, and finally generate the PDF based on the selected decklist paper size.

    try {

        console.log("Generating PDF for constructed deck...");
        await preloadCardArtForCards(decklistCards);


    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.disabled = false;
        generatePdfButton.textContent = originalLabel;
        syncGeneratePdfButton();
        await updateStatusSummary();

    }
    // CODE EXAMPLE : Simple experiment below that only generates a PDF for the current preview state without considering the full sealed deck.
    /*
    try {
        const pdfBlob = await generateCardSheetPdf({
            faces: currentPreviewState.faces,
            artByFaceSerial: renderedFaceArt,
            pageBackground: "#ffffff",
            renderOptions: {
                padding: 5, // Example padding value, adjust as needed
                background: "#000000"
            }
        });

        downloadGeneratedPdf(currentPreviewState.card.name, pdfBlob);
        await updateStatusSummary(`Generated PDF for ${currentPreviewState.card.name}.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.disabled = false;
        generatePdfButton.textContent = originalLabel;
        syncGeneratePdfButton();
    }
    */
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

async function updateStatusSummary(note?: string): Promise<void> {
    const cachedArtCount = await getCachedFaceArtCount();
    const summary = `Total cards: ${statusSummary.totalCards}, Card names: ${statusSummary.totalCardNames}, Total faces: ${statusSummary.totalFaces}, Cached art: ${cachedArtCount}`;
    setStatus(note ? `${summary}. ${note}` : summary);
}

function setPreview(message: string): void {
    // Just console log the message for now.
    console.log(message);
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

function parseSingleCards(rawText: string): Card[] {
    const lines = rawText.split(/\r?\n/);
    const result: Card[] = [];
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
        clearCurrentPreviewState();
        setPreview(`No card found starting with "${query}".`);
        // Clear the canvas!
        utils.clearCanvas(canvasElement);
        return;
    }
    const serial = allCardsIndexes[matchedIndex];
    const card = singleCards[serial - 1]; // Why do I have to subtract 1? Because serials are 1-based, but array indexes are 0-based.
    if (!card) {
        clearCurrentPreviewState();
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

    releaseRenderedFaceArt();

    try {
        renderedFaceArt = await loadFaceArtForCard({
            card,
            faces,
            scryfallEditions: possibleCardEditions,
        }, artData);
    } catch (error) {
        console.error(`Error fetching card data for ${cardName}:`, error);
        throw error;
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
    currentPreviewState = { card, faces };
    syncGeneratePdfButton();
    setPreview(previewText);

}

function clearCurrentPreviewState(): void {
    currentPreviewState = null;
    syncGeneratePdfButton();
}

function syncGeneratePdfButton(): void {
    if (generatePdfButton) {
        generatePdfButton.disabled = activeDeckTab === "sealed"
            ? !Object.values(editionSelection).some(Boolean)
            : (decklistTextArea?.value.trim() ?? "") === "";
    }

    if (addToDecklistButton) {
        addToDecklistButton.disabled = currentPreviewState === null;
    }
}

function syncGenerateSealedButton(): void {
    syncGeneratePdfButton();
}

function releaseRenderedFaceArt(): void {
    for (const artBitmap of renderedFaceArt.values()) {
        artBitmap.close();
    }

    renderedFaceArt = new Map<number, ImageBitmap>();
}

function downloadArtCacheExport(exportBlob: Blob): void {
    const downloadUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `ccg-craft-art-cache-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}

function downloadDecklist(text: string): void {
    const exportBlob = new Blob([text], { type: "text/plain" });
    const downloadUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `ccg-craft-decklist-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}

function downloadGeneratedPdf(cardName: string, pdfBlob: Blob): void {
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${toDownloadSlug(cardName)}-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}

function toDownloadSlug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "card";
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

        if (editionCheckboxesContainer) {
            editionSelection = buildEditionCheckboxes(editions, editionCheckboxesContainer, syncGenerateSealedButton);
            syncGenerateSealedButton();
        }

        // Fetch art-data.json and parse it
        response = await fetch("art-data.json");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        text = await response.text();
        Object.assign(artData, JSON.parse(text));

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

        statusSummary = {
            totalCards: singleCards.length,
            totalCardNames: allCardsNames.length,
            totalFaces: faceData.length,
        };

        await updateStatusSummary();




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