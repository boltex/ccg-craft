import "./styles.css";

import {
    clearCachedFaceArt,
    exportCachedFaceArt,
    getCachedFaceArtCount,
    importCachedFaceArt
} from "./art-cache";
import * as utils from "./utils";
import * as constants from "./constants";
import { buildEditionCheckboxes } from "./edition-filter";
import { CardDatabase } from "./card-database";
import { CardPreviewController } from "./preview-controller";
import { downloadDecklist } from "./decklist";
import { generateConstructedDeckPdf, generateSealedDeckPdf, selectSealedCardPool } from "./deck-pdf";
import type { PrintableFace } from "./types";

// Webpack can be configured to import images directly as inline Base64 data URIs
// Let's import the 8 possible background images for the card frames

// @ts-expect-error
import frameLBackground300dpiJpg from "../public/fl-300dpi.jpg?inline";
// @ts-expect-error 
import frameABackground300dpiJpg from "../public/fa-300dpi.jpg?inline";
// @ts-expect-error 
import frameWBackground300dpiJpg from "../public/fw-300dpi.jpg?inline";
// @ts-expect-error 
import frameUBackground300dpiJpg from "../public/fu-300dpi.jpg?inline";
// @ts-expect-error 
import frameBBackground300dpiJpg from "../public/fb-300dpi.jpg?inline";
// @ts-expect-error 
import frameRBackground300dpiJpg from "../public/fr-300dpi.jpg?inline";
// @ts-expect-error 
import frameGBackground300dpiJpg from "../public/fg-300dpi.jpg?inline";
// @ts-expect-error 
import frameZBackground300dpiJpg from "../public/fz-300dpi.jpg?inline";


// @ts-expect-error
import tbLBackground300dpiPng from "../public/tb300dpi-l.png?inline";
// @ts-expect-error 
import tbABackground300dpiPng from "../public/tb300dpi-a.png?inline";
// @ts-expect-error 
import tbWBackground300dpiPng from "../public/tb300dpi-w.png?inline";
// @ts-expect-error 
import tbUBackground300dpiPng from "../public/tb300dpi-u.png?inline";
// @ts-expect-error 
import tbBBackground300dpiPng from "../public/tb300dpi-b.png?inline";
// @ts-expect-error 
import tbRBackground300dpiPng from "../public/tb300dpi-r.png?inline";
// @ts-expect-error 
import tbGBackground300dpiPng from "../public/tb300dpi-g.png?inline";
// @ts-expect-error 
import tbZBackground300dpiPng from "../public/tb300dpi-z.png?inline";

// Leave as string for later pdfkit conversion to image objects in pdf-exports.ts.
const frameBackgroundsImportsStrings: Record<number, string> = {
    [constants.frame.frameL]: frameLBackground300dpiJpg,
    [constants.frame.frameA]: frameABackground300dpiJpg,
    [constants.frame.frameW]: frameWBackground300dpiJpg,
    [constants.frame.frameU]: frameUBackground300dpiJpg,
    [constants.frame.frameB]: frameBBackground300dpiJpg,
    [constants.frame.frameR]: frameRBackground300dpiJpg,
    [constants.frame.frameG]: frameGBackground300dpiJpg,
    [constants.frame.frameZ]: frameZBackground300dpiJpg,
};

// Convert to ImageBitmap for canvas rendering
const frameBackgroundsImageBitmap: Record<number, ImageBitmap> = {
    [constants.frame.frameL]: await createImageBitmap(await (await fetch(frameLBackground300dpiJpg)).blob()),
    [constants.frame.frameA]: await createImageBitmap(await (await fetch(frameABackground300dpiJpg)).blob()),
    [constants.frame.frameW]: await createImageBitmap(await (await fetch(frameWBackground300dpiJpg)).blob()),
    [constants.frame.frameU]: await createImageBitmap(await (await fetch(frameUBackground300dpiJpg)).blob()),
    [constants.frame.frameB]: await createImageBitmap(await (await fetch(frameBBackground300dpiJpg)).blob()),
    [constants.frame.frameR]: await createImageBitmap(await (await fetch(frameRBackground300dpiJpg)).blob()),
    [constants.frame.frameG]: await createImageBitmap(await (await fetch(frameGBackground300dpiJpg)).blob()),
    [constants.frame.frameZ]: await createImageBitmap(await (await fetch(frameZBackground300dpiJpg)).blob()),
};

// Leave as string for later pdfkit conversion to image objects in pdf-exports.ts.
const textBoxImportsStrings: Record<number, string> = {
    [constants.frame.frameL]: tbLBackground300dpiPng,
    [constants.frame.frameA]: tbABackground300dpiPng,
    [constants.frame.frameW]: tbWBackground300dpiPng,
    [constants.frame.frameU]: tbUBackground300dpiPng,
    [constants.frame.frameB]: tbBBackground300dpiPng,
    [constants.frame.frameR]: tbRBackground300dpiPng,
    [constants.frame.frameG]: tbGBackground300dpiPng,
    [constants.frame.frameZ]: tbZBackground300dpiPng,
};

// Convert to ImageBitmap for canvas rendering
const textBoxImageBitmap: Record<number, ImageBitmap> = {
    [constants.frame.frameL]: await createImageBitmap(await (await fetch(tbLBackground300dpiPng)).blob()),
    [constants.frame.frameA]: await createImageBitmap(await (await fetch(tbABackground300dpiPng)).blob()),
    [constants.frame.frameW]: await createImageBitmap(await (await fetch(tbWBackground300dpiPng)).blob()),
    [constants.frame.frameU]: await createImageBitmap(await (await fetch(tbUBackground300dpiPng)).blob()),
    [constants.frame.frameB]: await createImageBitmap(await (await fetch(tbBBackground300dpiPng)).blob()),
    [constants.frame.frameR]: await createImageBitmap(await (await fetch(tbRBackground300dpiPng)).blob()),
    [constants.frame.frameG]: await createImageBitmap(await (await fetch(tbGBackground300dpiPng)).blob()),
    [constants.frame.frameZ]: await createImageBitmap(await (await fetch(tbZBackground300dpiPng)).blob()),
};

const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const lookupElement = document.querySelector<HTMLInputElement>("#card-lookup");
const clearArtCacheButton = document.querySelector<HTMLButtonElement>("#clear-art-cache");
const exportArtCacheButton = document.querySelector<HTMLButtonElement>("#export-art-cache");
const importArtCacheButton = document.querySelector<HTMLButtonElement>("#import-art-cache")
const generatePdfButton = document.querySelector<HTMLButtonElement>("#generate-deck-pdf");
const importArtCacheFileInput = document.querySelector<HTMLInputElement>("#import-art-cache-file");
const editionCheckboxesContainer = document.querySelector<HTMLElement>("#edition-checkboxes");
const decklistTextArea = document.querySelector<HTMLTextAreaElement>("#decklist-text");
const decklistPaperSizeSelect = document.querySelector<HTMLSelectElement>("#decklist-paper-size");
const loadDecklistButton = document.querySelector<HTMLButtonElement>("#load-decklist");
const saveDecklistButton = document.querySelector<HTMLButtonElement>("#save-decklist");
const clearDecklistButton = document.querySelector<HTMLButtonElement>("#clear-decklist");
const loadDecklistFileInput = document.querySelector<HTMLInputElement>("#load-decklist-file");
const addToDecklistButton = document.querySelector<HTMLButtonElement>("#add-to-decklist");
const addP9ToDecklistButton = document.querySelector<HTMLButtonElement>("#add-p9-to-decklist");
const generateSheetButton = document.querySelector<HTMLButtonElement>("#generate-sheet");
const deckTabButtons = document.querySelectorAll<HTMLButtonElement>(".deck-tab");
const deckPanels: Record<string, HTMLElement | null> = {
    constructed: document.querySelector<HTMLElement>("#deck-panel-constructed"),
    sealed: document.querySelector<HTMLElement>("#deck-panel-sealed"),
    sheet: document.querySelector<HTMLElement>("#deck-panel-sheet"),
};
const canvasElement = document.querySelector<HTMLCanvasElement>("#card-preview");
const frameBgElements = document.querySelectorAll<HTMLDivElement>(".frame-bg");

let activeDeckTab: "constructed" | "sealed" | "sheet" = "constructed";
let editionSelection: Record<string, boolean> = {};

const cardDatabase = new CardDatabase();
const previewController = new CardPreviewController(canvasElement);
const previewHistory: string[] = []; // Contains the cards previously previewed (can use up/down arrow keys to navigate)
let previewHistoryIndex = -1; // Tracks the current position in the preview history

const PREVIEW_HISTORY_STORAGE_KEY = "ccg-craft:preview-history";
const PREVIEW_HISTORY_MAX = 99;
let previewHistorySaveTimeout: number | undefined;

let isDebug = false;

// Add a listener to the lookup input field to handle card name lookups, debounced to avoid excessive processing.
if (lookupElement) {
    let debounceTimeout: number | undefined;

    // Handle up/down arrow keys to navigate the preview history.
    lookupElement.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            if (previewHistoryIndex > 0) {
                previewHistoryIndex--;
                const previousCard = previewHistory[previewHistoryIndex];
                // replace text in input field with the previous card
                lookupElement.value = previousCard;
                // Now trigger the input event to update the preview
                lookupElement.dispatchEvent(new Event("input"));
                schedulePreviewHistorySave();
            }
        } else if (event.key === "ArrowDown") {
            if (previewHistoryIndex < previewHistory.length - 1) {
                previewHistoryIndex++;
                const nextCard = previewHistory[previewHistoryIndex];
                // replace text in input field with the next card
                lookupElement.value = nextCard;
                // Now trigger the input event to update the preview
                lookupElement.dispatchEvent(new Event("input"));
                schedulePreviewHistorySave();
            }
        }
    });


    lookupElement.addEventListener("input", () => {
        if (cardDatabase.stats.totalFaces === 0 || cardDatabase.stats.totalCards === 0) {
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

            // replace double slash with a single slash
            query = query.replace(/\/\//g, "/");

            // Replace slash by a vertical bar
            query = query.replace(/\//g, "|");

            if (query) {
                try {
                    await showCardPreview(query);
                    await updateStatusSummary();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    setStatus(`Failed to show card preview: ${message}`);
                    previewController.clear();
                    setPreview("Failed to show card preview.");
                }
            } else {
                resetPageBackgroundColor();
                previewController.clear();
                if (addToDecklistButton) {
                    addToDecklistButton.disabled = previewController.currentCard === null;
                }
                await updateStatusSummary();
            }
        }, 300); // 300ms debounce
    });
    // React also on enter press in the lookup input field
    lookupElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const currentCard = previewController.currentCard;
            if (!currentCard || !decklistTextArea) {
                return;
            }

            const existingText = decklistTextArea.value;
            const separator = existingText.length > 0 && !existingText.endsWith("\n") ? "\n" : "";
            decklistTextArea.value = `${existingText}${separator}${currentCard.name}\n`;
            syncGeneratePdfButton();
            // * Let's leave the input as-is - commented off code below was clearing it.
            // // Now also clear the input
            // lookupElement.value = "";
            // resetPageBackgroundColor();
            // previewController.clear();
            // if (addToDecklistButton) {
            //     addToDecklistButton.disabled = previewController.currentCard === null;
            // }
            updateStatusSummary();
        }
    });
}

if (generatePdfButton) {
    generatePdfButton.addEventListener("click", async () => {

        // Modes of this app: Sealed deck and constructed deck PDF generation

        if (activeDeckTab === "sealed") {
            await generateSealedPDF();
        } else if (activeDeckTab === "constructed") {
            await generateConstructedPDF();
        }

    });
}

if (deckTabButtons.length > 0) {
    deckTabButtons.forEach(tabButton => {
        tabButton.addEventListener("click", () => {
            const tab = tabButton.dataset.deckTab;
            if (tab !== "constructed" && tab !== "sealed" && tab !== "sheet") {
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

if (generateSheetButton) {
    generateSheetButton.addEventListener("click", () => {
        console.log("Generate Limited Rare uncut sheet clicked");
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
            updateStatusSummary();
        }
    });
}

if (addToDecklistButton) {
    addToDecklistButton.addEventListener("click", () => {
        const currentCard = previewController.currentCard;
        if (!currentCard || !decklistTextArea) {
            return;
        }

        const existingText = decklistTextArea.value;
        const separator = existingText.length > 0 && !existingText.endsWith("\n") ? "\n" : "";
        decklistTextArea.value = `${existingText}${separator}${currentCard.name}\n`;
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

        utils.trackEvent("add_power_9_to_decklist");

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

            utils.trackEvent("clear_art_cache");

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

            utils.trackEvent("export_art_cache");

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

            utils.trackEvent("import_art_cache");

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Failed to import art cache: ${message}`);
        }
    });
}

async function generateSealedPDF(): Promise<void> {
    const selectedEditions = Object.entries(editionSelection)
        .filter(([, checked]) => checked)
        .map(([code]) => code);

    const cardPool = selectSealedCardPool(cardDatabase, selectedEditions);

    // TODO : Move this information to the main screen UI instead of logging to the console.
    // TODO: also show this when checking/unchecking editions instead of when generating the sealed deck itself!
    // console.log(`Total unique available cards without basic lands: ${cardPool.length}`);

    if (cardPool.length === 0 || !generatePdfButton) {
        setStatus("No cards are available for the selected editions.");
        return;
    }

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating PDF...";

    try {
        const pdfBlob = await generateSealedDeckPdf({
            cardPool,
            cardDatabase,
            paperSize: decklistPaperSizeSelect?.value,
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
            textBoxImportsStrings: textBoxImportsStrings
        });

        utils.trackEvent("generate_sealed_pdf", { selectedEditions });

        downloadGeneratedPdf("sealed-deck", pdfBlob);
        await updateStatusSummary(`Generated PDF for sealed deck.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(" Error generating PDF: ", error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.disabled = false;
        generatePdfButton.textContent = originalLabel;
        syncGeneratePdfButton();
    }
}

async function generateConstructedPDF(): Promise<void> {
    if (!generatePdfButton) {
        return;
    }

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating PDF...";

    try {
        const pdfBlob = await generateConstructedDeckPdf({
            decklistText: decklistTextArea?.value ?? "",
            cardDatabase,
            paperSize: decklistPaperSizeSelect?.value,
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
            textBoxImportsStrings: textBoxImportsStrings
        });

        utils.trackEvent("generate_constructed_pdf");

        downloadGeneratedPdf("constructed-deck", pdfBlob);
        await updateStatusSummary(`Generated PDF for Decklist.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(" Error generating PDF: ", error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.disabled = false;
        generatePdfButton.textContent = originalLabel;
        syncGeneratePdfButton();
    }
}

function setStatus(message: string): void {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

async function updateStatusSummary(note?: string): Promise<void> {
    const cachedArtCount = await getCachedFaceArtCount();
    const { totalCards, totalCardNames, totalFaces } = cardDatabase.stats;
    const summary = `Total cards: ${totalCards}, Card names: ${totalCardNames}, Total faces: ${totalFaces}, Cached art: ${cachedArtCount}`;
    setStatus(note ? `${summary}. ${note}` : summary);
}

function setPreview(message: string): void {
    // Just console log the message for now.
    console.log(message);
}

// Adds a card to the preview history, truncating any forward history and capping the total size.
function pushPreviewHistory(cardName: string): void {
    const existingIndex = previewHistory.indexOf(cardName);
    if (existingIndex !== -1) {
        return;
    }

    if (previewHistoryIndex < previewHistory.length - 1) {
        previewHistory.splice(previewHistoryIndex + 1);
    }
    previewHistory.push(cardName);
    previewHistoryIndex = previewHistory.length - 1;

    if (previewHistory.length > PREVIEW_HISTORY_MAX) {
        const overflow = previewHistory.length - PREVIEW_HISTORY_MAX;
        previewHistory.splice(0, overflow);
        previewHistoryIndex = Math.max(0, previewHistoryIndex - overflow);
    }

    schedulePreviewHistorySave();
}

function schedulePreviewHistorySave(): void {
    if (previewHistorySaveTimeout) {
        clearTimeout(previewHistorySaveTimeout);
    }
    previewHistorySaveTimeout = window.setTimeout(savePreviewHistory, 300);
}

function savePreviewHistory(): void {
    try {
        const payload = JSON.stringify({ history: previewHistory, index: previewHistoryIndex });
        window.localStorage.setItem(PREVIEW_HISTORY_STORAGE_KEY, payload);
    } catch (error) {
        console.error("Failed to save preview history:", error);
    }
}

// Best-effort restore; any missing/invalid data simply leaves the history empty.
function restorePreviewHistory(): void {
    try {
        const raw = window.localStorage.getItem(PREVIEW_HISTORY_STORAGE_KEY);
        if (!raw) {
            return;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.history) || !parsed.history.every((entry: unknown) => typeof entry === "string")) {
            return;
        }

        const history: string[] = parsed.history.slice(-PREVIEW_HISTORY_MAX);
        const index = typeof parsed.index === "number" ? parsed.index : history.length - 1;

        previewHistory.splice(0, previewHistory.length, ...history);
        previewHistoryIndex = Math.min(Math.max(index, -1), previewHistory.length - 1);
    } catch (error) {
        console.error("Failed to restore preview history:", error);
    }
}

async function showCardPreview(query: string): Promise<void> {
    const serial = cardDatabase.findCardSerialByNamePrefix(query);
    if (serial === undefined) {
        previewController.clear();
        resetPageBackgroundColor();
        return;
    }

    const card = cardDatabase.getCardBySerial(serial);
    if (!card) {
        previewController.clear();
        setPreview(`No card found for serial: ${serial}`);
        resetPageBackgroundColor();
        return;
    }

    // Faces are the one or two printable faces on the surface of the card; the second may be undefined.
    const faces = cardDatabase.getFaceData(serial);

    const previewText = await previewController.showCard(card, faces, cardDatabase.editions, cardDatabase.editionsScry, frameBackgroundsImageBitmap, textBoxImageBitmap);

    // We've found and shown the card preview, 
    // If not already in history: add it at current position in history and delete forward history beyond the current index.
    // If already in history, ignore this as the user is simply looking and brwosing with up/down keys.
    pushPreviewHistory(card.name);

    // If needed, uncomment to display the preview text in the preview area.
    if (isDebug) {
        setPreview(previewText); // Show the card data.
    }

    // If the card has two faces, just take the first face for determining the background color.
    const firstFace = faces[0];
    if (firstFace) {
        setPageDecorationColors(firstFace);
    } else {
        resetPageBackgroundColor();
    }

    syncGeneratePdfButton();
}

// Tints the page background with the previewed card's frame color, layered as a translucent wash over the base gradient.
function setPageDecorationColors(face: PrintableFace): void {
    let [r, g, b] = face.faceColors.frameColor.map(channel => Math.min(255, Math.max(0, Math.round(channel))));
    document.documentElement.style.setProperty("--page-background-color", `rgba(${r}, ${g}, ${b}, 1)`);
    [r, g, b] = face.faceColors.tbColor.map(channel => Math.min(255, Math.max(0, Math.round(channel))));
    document.documentElement.style.setProperty("--page-background-tb-color", `rgba(${r}, ${g}, ${b}, 1)`);

    // faceFrame is the same enum index (0-7) as each layer's data-frame-index, so it can be matched directly.
    frameBgElements.forEach(element => {
        element.classList.toggle("active", element.dataset.frameIndex === String(face.faceFrame));
    });
}

function resetPageBackgroundColor(): void {
    document.documentElement.style.removeProperty("--page-background-color");
    document.documentElement.style.removeProperty("--page-background-tb-color");
    frameBgElements.forEach(element => element.classList.remove("active"));
}

function syncGeneratePdfButton(): void {
    if (decklistPaperSizeSelect) {
        decklistPaperSizeSelect.disabled = activeDeckTab === "sheet";
    }

    if (generatePdfButton) {
        if (activeDeckTab === "sheet") {
            generatePdfButton.disabled = true;
        } else if (activeDeckTab === "sealed") {
            generatePdfButton.disabled = !Object.values(editionSelection).some(Boolean);
        } else {
            generatePdfButton.disabled = (decklistTextArea?.value.trim() ?? "") === "";
        }
    }

    if (addToDecklistButton) {
        addToDecklistButton.disabled = previewController.currentCard === null;
    }
}

function downloadArtCacheExport(exportBlob: Blob): void {
    const downloadUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `ccg-craft-art-cache-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}

function downloadGeneratedPdf(title: string, pdfBlob: Blob): void {
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${toDownloadSlug(title)}-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}

function toDownloadSlug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "decklist";
}

async function bootstrap(): Promise<void> {
    restorePreviewHistory();

    if (lookupElement) {
        requestAnimationFrame(() => {
            lookupElement.focus();
        });
    }

    try {
        await cardDatabase.load();

        if (editionCheckboxesContainer) {
            editionSelection = buildEditionCheckboxes(cardDatabase.editionsScry, editionCheckboxesContainer, syncGeneratePdfButton);
            syncGeneratePdfButton();
        }

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
        console.error(error);
    }
}

void bootstrap();
