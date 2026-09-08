import "./styles.css";

import {
    clearCachedFaceArt,
    exportCachedFaceArt,
    getCachedFaceArtCount,
    importCachedFaceArt
} from "./art-cache";
import * as constants from "./constants";
import { buildEditionCheckboxes } from "./edition-filter";
import { CardDatabase } from "./card-database";
import { CardPreviewController } from "./preview-controller";
import { downloadDecklist } from "./decklist";
import { generateConstructedDeckPdf, generateSealedDeckPdf, selectSealedCardPool } from "./deck-pdf";

// Webpack can be configured to import images directly as inline Base64 data URIs
// Let's import the 8 possible background images for the card frames

// @ts-expect-error The imported image is treated as a module due to the '?inline' query.
import frameLBackground from "../public/fl.png?inline";
// @ts-expect-error 
import frameABackground from "../public/fa.png?inline";
// @ts-expect-error 
import frameWBackground from "../public/fw.png?inline";
// @ts-expect-error 
import frameUBackground from "../public/fu.png?inline";
// @ts-expect-error 
import frameBBackground from "../public/fb.png?inline";
// @ts-expect-error 
import frameRBackground from "../public/fr.png?inline";
// @ts-expect-error 
import frameGBackground from "../public/fg.png?inline";
// @ts-expect-error 
import frameZBackground from "../public/fz.png?inline";

// Leave as string for later pdfkit conversion to image objects in pdf-exports.ts
const frameBackgroundsImportsStrings: Record<number, string> = {
    [constants.frame.frameL]: frameLBackground,
    [constants.frame.frameA]: frameABackground,
    [constants.frame.frameW]: frameWBackground,
    [constants.frame.frameU]: frameUBackground,
    [constants.frame.frameB]: frameBBackground,
    [constants.frame.frameR]: frameRBackground,
    [constants.frame.frameG]: frameGBackground,
    [constants.frame.frameZ]: frameZBackground,
};

// Convert to ImageBitmap for canvas rendering
const frameBackgroundsImageBitmap: Record<number, ImageBitmap> = {
    [constants.frame.frameL]: await createImageBitmap(await (await fetch(frameLBackground)).blob()),
    [constants.frame.frameA]: await createImageBitmap(await (await fetch(frameABackground)).blob()),
    [constants.frame.frameW]: await createImageBitmap(await (await fetch(frameWBackground)).blob()),
    [constants.frame.frameU]: await createImageBitmap(await (await fetch(frameUBackground)).blob()),
    [constants.frame.frameB]: await createImageBitmap(await (await fetch(frameBBackground)).blob()),
    [constants.frame.frameR]: await createImageBitmap(await (await fetch(frameRBackground)).blob()),
    [constants.frame.frameG]: await createImageBitmap(await (await fetch(frameGBackground)).blob()),
    [constants.frame.frameZ]: await createImageBitmap(await (await fetch(frameZBackground)).blob()),
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
const deckTabButtons = document.querySelectorAll<HTMLButtonElement>(".deck-tab");
const deckPanels: Record<string, HTMLElement | null> = {
    constructed: document.querySelector<HTMLElement>("#deck-panel-constructed"),
    sealed: document.querySelector<HTMLElement>("#deck-panel-sealed"),
};
const canvasElement = document.querySelector<HTMLCanvasElement>("#card-preview");

let activeDeckTab: "constructed" | "sealed" = "constructed";
let editionSelection: Record<string, boolean> = {};

const cardDatabase = new CardDatabase();
const previewController = new CardPreviewController(canvasElement);

// Add a listener to the lookup input field to handle card name lookups, debounced to avoid excessive processing.
if (lookupElement) {
    let debounceTimeout: number | undefined;
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
                previewController.clear();
                setPreview("Please enter a card name to look up.");
                await updateStatusSummary();
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
            await generateConstructedPDF();
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

async function generateSealedPDF(): Promise<void> {
    const selectedEditions = Object.entries(editionSelection)
        .filter(([, checked]) => checked)
        .map(([code]) => code);

    const cardPool = selectSealedCardPool(cardDatabase, selectedEditions);
    console.log(`Total unique available cards without basic lands: ${cardPool.length}`);

    if (cardPool.length === 0 || !generatePdfButton) {
        setStatus("No cards are available for the selected editions.");
        return;
    }

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating PDF...";

    try {
        console.log("Generating PDF for sealed deck...");
        const pdfBlob = await generateSealedDeckPdf({
            cardPool,
            cardDatabase,
            paperSize: decklistPaperSizeSelect?.value,
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
        });

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
        console.log("Generating PDF for constructed deck...");
        const pdfBlob = await generateConstructedDeckPdf({
            decklistText: decklistTextArea?.value ?? "",
            cardDatabase,
            paperSize: decklistPaperSizeSelect?.value,
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
        });

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

async function showCardPreview(query: string): Promise<void> {
    const serial = cardDatabase.findCardSerialByNamePrefix(query);
    if (serial === undefined) {
        previewController.clear();
        setPreview(`No card found starting with "${query}".`);
        return;
    }

    const card = cardDatabase.getCardBySerial(serial);
    if (!card) {
        previewController.clear();
        setPreview(`No card found for serial: ${serial}`);
        return;
    }

    // Faces are the one or two printable faces on the surface of the card; the second may be undefined.
    const faces = cardDatabase.getFaceData(serial);

    const previewText = await previewController.showCard(card, faces, cardDatabase.editions, cardDatabase.editionsScry, frameBackgroundsImageBitmap);
    syncGeneratePdfButton();
    setPreview(previewText);
}

function syncGeneratePdfButton(): void {
    if (generatePdfButton) {
        generatePdfButton.disabled = activeDeckTab === "sealed"
            ? !Object.values(editionSelection).some(Boolean)
            : (decklistTextArea?.value.trim() ?? "") === "";
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
    if (lookupElement) {
        requestAnimationFrame(() => {
            lookupElement.focus();
        });
    }

    try {
        await cardDatabase.load();

        if (editionCheckboxesContainer) {
            editionSelection = buildEditionCheckboxes([...cardDatabase.editions], editionCheckboxesContainer, syncGeneratePdfButton);
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
