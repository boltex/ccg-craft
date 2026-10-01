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
import { generateConstructedDeckPdf, generateSealedDeckPdf, generateSheetPdf, selectSealedCardPool, generateOldSchoolCache, countSealedCardPool } from "./deck-pdf";
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
import { uncutSheets } from "./uncut-sheets-serials";
import { packData, PackSimController } from "./pack-sim";
import { getArtLoadingOptions, setArtLoadingOptions } from "./art-settings";

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

const bgDecoRectangle = document.querySelector<HTMLDivElement>("#bg-deco-rectangle");
const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const statisticsElement = document.querySelector<HTMLParagraphElement>("#statistics");
const lookupElement = document.querySelector<HTMLInputElement>("#card-lookup");
const clearArtCacheButton = document.querySelector<HTMLButtonElement>("#clear-art-cache");
const exportArtCacheButton = document.querySelector<HTMLButtonElement>("#export-art-cache");
const importArtCacheButton = document.querySelector<HTMLButtonElement>("#import-art-cache")
const randomizePacksButton = document.querySelector<HTMLButtonElement>("#randomize-packs");
const resetPacksCollationButton = document.querySelector<HTMLButtonElement>("#reset-packs-collation");
const generatePdfButton = document.querySelector<HTMLButtonElement>("#generate-deck-pdf");
const importArtCacheFileInput = document.querySelector<HTMLInputElement>("#import-art-cache-file");
const cacheOldSchoolButton = document.querySelector<HTMLButtonElement>("#cache-old-school");
const highResolutionArtCheckbox = document.querySelector<HTMLInputElement>("#high-resolution-art");
const useLocalArtDatabaseCheckbox = document.querySelector<HTMLInputElement>("#use-local-art-database");
const borderToggleButton = document.querySelector<HTMLButtonElement>("#border-toggle");
const whiteBorderCheckbox = document.querySelector<HTMLInputElement>("#white-border");
const editionCheckboxesContainer = document.querySelector<HTMLElement>("#edition-checkboxes");
const decklistTextArea = document.querySelector<HTMLTextAreaElement>("#decklist-text");
const decklistPaperSizeSelect = document.querySelector<HTMLSelectElement>("#decklist-paper-size");
const loadDecklistButton = document.querySelector<HTMLButtonElement>("#load-decklist");
const saveDecklistButton = document.querySelector<HTMLButtonElement>("#save-decklist");
const clearDecklistButton = document.querySelector<HTMLButtonElement>("#clear-decklist");
const loadDecklistFileInput = document.querySelector<HTMLInputElement>("#load-decklist-file");
const addToDecklistButton = document.querySelector<HTMLButtonElement>("#add-to-decklist");
const addP9ToDecklistButton = document.querySelector<HTMLButtonElement>("#add-p9-to-decklist");
const addPacksButtonsContainer = document.querySelector<HTMLDivElement>("#add-packs-buttons");
const sheetRaritySelect = document.querySelector<HTMLSelectElement>("#sheet-rarity-select");
const deckTabsContainer = document.querySelector<HTMLDivElement>("#deck-tabs");
const deckTabButtons = document.querySelectorAll<HTMLButtonElement>(".deck-tab");
const deckPanels: Record<string, HTMLElement | null> = {
    constructed: document.querySelector<HTMLElement>("#deck-panel-constructed"),
    sealed: document.querySelector<HTMLElement>("#deck-panel-sealed"),
    sheet: document.querySelector<HTMLElement>("#deck-panel-sheet"),
    db: document.querySelector<HTMLElement>("#deck-panel-db"),
};
const canvasElement = document.querySelector<HTMLCanvasElement>("#card-preview");
const frameBgElements = document.querySelectorAll<HTMLDivElement>(".frame-bg");

let activeDeckTab: "constructed" | "sealed" | "sheet" | "db" = "constructed";
let editionSelection: Record<string, boolean> = {};
let poolSizeUpdateTimeout: number | undefined;

const cardDatabase = new CardDatabase();
const previewController = new CardPreviewController(canvasElement);
const previewHistory: string[] = []; // Contains the cards previously previewed (can use up/down arrow keys to navigate)
let previewHistoryIndex = -1; // Tracks the current position in the preview history

const PREVIEW_HISTORY_STORAGE_KEY = "ccg-craft:preview-history";
const HIGH_RESOLUTION_ART_STORAGE_KEY = "ccg-craft:high-resolution-art";
const USE_LOCAL_ART_DATABASE_STORAGE_KEY = "ccg-craft:use-local-art-database";
const WHITE_BORDER_STORAGE_KEY = "ccg-craft:white-border";
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
            let query = lookupElement.value.trim();

            // Convert accented letters to their plain lowercase version
            query = fixQueryString(query);

            if (query) {
                try {
                    await showCardPreview(query);
                    await updateStatistics();
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
                await updateStatistics();
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

            lookupElement.value = currentCard.name;

            updateStatistics();
        }
    });
}

if (bgDecoRectangle) {

    const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);

    // While true, a click-shove animation is in control of the transform; mousemove tracking pauses until it finishes.
    let isShoving = false;
    let isTaglineRotating = false;
    let totalClicks = 0;

    // Preloaded so the browser has already fetched/decoded them by the time of the first click.
    const shoveSounds = ["clink1.wav", "clink2.wav", "clink3.wav"].map(file => new Audio(file));

    document.addEventListener("mousemove", (event) => {
        if (isShoving) {
            return;
        }

        const rect = bgDecoRectangle.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;

        const rotateY = clamp(dx * 0.01, -5, 5);
        const rotateX = clamp(-dy * 0.01, -5, 5);

        bgDecoRectangle.style.transform =
            `translateY(-3px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    // Temporary "shoved" effect when clicking directly on bgDecoRectangle, as if pushed down toward the click point.
    bgDecoRectangle.addEventListener("click", (event) => {
        totalClicks++;

        // Play one of the 3 sound effects associated with the shove action. (clink1.wav, click2.wav or click3.wav)
        const sound = shoveSounds[Math.floor(Math.random() * shoveSounds.length)].cloneNode(true) as HTMLAudioElement;

        // Set its volume between 0.3 and 0.6
        sound.volume = 0.3 + Math.random() * 0.3;

        void sound.play().catch(() => { /* Ignore playback failures, e.g. browser autoplay restrictions. */ });

        const rect = bgDecoRectangle.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;

        const rotateY = clamp(dx * 0.01, -5, 5);
        const rotateX = clamp(-dy * 0.01, -5, 5);

        isShoving = true;

        bgDecoRectangle.style.transition = "transform 40ms ease-out";
        bgDecoRectangle.style.transform =
            `translateY(2px) translateZ(-8px) scale(0.97) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

        window.setTimeout(() => {
            bgDecoRectangle.style.transition = "transform 90ms ease-out";
            bgDecoRectangle.style.transform =
                `translateY(-3px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

            window.setTimeout(() => {
                bgDecoRectangle.style.transition = "";
                isShoving = false;
            }, 90);
        }, 40);

        if (totalClicks === 10) {
            isTaglineRotating = !isTaglineRotating;
        }
        if (isTaglineRotating) {
            // Rotate gradually up to 8 degrees and stop there
            // its style is .tagline {
            // transform: translateZ(25px);

            // so it shoud become 
            // `translateZ(25px) rotateY(8deg)`

            const tagline = document.querySelector<HTMLElement>(".tagline");
            if (tagline) {
                tagline.style.transform = "translateZ(25px) rotateY(8deg)";
            }



        }

    });
}

if (generatePdfButton) {
    generatePdfButton.addEventListener("click", async () => {

        // Modes of this app: Sealed deck and constructed deck PDF generation

        if (activeDeckTab === "sealed") {
            await generateSealedPDF(); // Does not use pack simulation
        } else if (activeDeckTab === "constructed") {
            await generateConstructedPDF();
            savePackSimState(); // The packs may have changed, so save their state. (Uses PackSimController)
        } else if (activeDeckTab === "sheet") {
            await generateSelectedSheetPdf(); // Does not use pack simulation
        }

    });
}

if (deckTabButtons.length > 0) {
    deckTabButtons.forEach(tabButton => {
        tabButton.addEventListener("click", () => {
            const tab = tabButton.dataset.deckTab || '';
            const possibleTabs = ["constructed", "sealed", "sheet", "db"];

            if (!possibleTabs.includes(tab)) {
                return;
            }
            activeDeckTab = tab as "constructed" | "sealed" | "sheet" | "db";

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
            updateStatistics();
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
            await updateStatistics("Art cache cleared.");

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

            // ask first
            if (!window.confirm("Export all cached art images to a zip archive?")) {
                return;
            }

            const exportBlob = await exportCachedFaceArt();
            downloadArtCacheExport(exportBlob);
            await updateStatistics("Art cache exported.");

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
            await updateStatistics(`Imported ${result.importedCount} art images.`);

            utils.trackEvent("import_art_cache");

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Failed to import art cache: ${message}`);
        }
    });
}

if (cacheOldSchoolButton) {
    cacheOldSchoolButton.addEventListener("click", async () => {
        if (!window.confirm("Cache art from limited and sets from Arabian Nights to Fallen Empires?")) {
            return;
        }

        const allSerials: number[] = [];
        let counter = 0;
        for (const key in uncutSheets) {
            const cardSerials = uncutSheets[key as keyof typeof uncutSheets];
            allSerials.push(...cardSerials.cards);
            counter++;
            if (counter === 2) {
                // stop for testing purposes after 2 sets
                break;
            }
        }
        await generateOldSchoolCache({
            cardDatabase,
            artLoadingOptions: getArtLoadingOptions(),
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
            textBoxImportsStrings: textBoxImportsStrings,
            onProgress: setStatus,
        }, allSerials);

        setStatus("Finished caching old school sets.");

    });
}

if (randomizePacksButton) {
    randomizePacksButton.addEventListener("click", async () => {
        await randomizePacks();
    });
}

if (resetPacksCollationButton) {
    resetPacksCollationButton.addEventListener("click", () => {
        resetPacksCollationHandler();
    });
}

if (whiteBorderCheckbox) {
    whiteBorderCheckbox.checked = window.localStorage.getItem(WHITE_BORDER_STORAGE_KEY) === "true";
    whiteBorderCheckbox.addEventListener("change", () => {
        window.localStorage.setItem(WHITE_BORDER_STORAGE_KEY, String(whiteBorderCheckbox.checked));
        if (borderToggleButton) {
            borderToggleButton.textContent = whiteBorderCheckbox.checked ? "W.B." : "B.B.";
        }
        refreshCurrentPreview();
    });
}
// Toggle border button is a shortcut button to toggle the white/black border setting
if (borderToggleButton) {
    // Set its content to "B.B." or "W.B." based on the current white border setting

    borderToggleButton.textContent = whiteBorderCheckbox && whiteBorderCheckbox.checked ? "W.B." : "B.B.";
    borderToggleButton.addEventListener("click", () => {
        if (whiteBorderCheckbox) {
            whiteBorderCheckbox.checked = !whiteBorderCheckbox.checked;
            window.localStorage.setItem(WHITE_BORDER_STORAGE_KEY, String(whiteBorderCheckbox.checked));

            // Update its content from "B.B." to "W.B." or vice versa
            borderToggleButton.textContent = whiteBorderCheckbox.checked ? "W.B." : "B.B.";

            refreshCurrentPreview();
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

    if (cardPool.length === 0 || !generatePdfButton || !decklistPaperSizeSelect) {
        setStatus("No cards are available for the selected editions.");
        return;
    }

    decklistPaperSizeSelect.disabled = true;

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating ...";

    try {
        disableDeckTabs();
        const pdfBlob = await generateSealedDeckPdf({
            cardPool,
            cardDatabase,
            artLoadingOptions: getArtLoadingOptions(),
            paperSize: decklistPaperSizeSelect?.value,
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
            textBoxImportsStrings: textBoxImportsStrings,
            whiteBorder: whiteBorderCheckbox?.checked ?? false
        });

        utils.trackEvent("generate_sealed_pdf", { selectedEditions });

        downloadGeneratedPdf("sealed", pdfBlob);
        await updateStatistics(`Generated PDF for sealed deck.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(" Error generating PDF: ", error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.textContent = originalLabel;
        enableDeckTabs();
        syncGeneratePdfButton();
    }
}

async function generateConstructedPDF(): Promise<void> {
    if (!generatePdfButton || !decklistPaperSizeSelect) {
        return;
    }
    decklistPaperSizeSelect.disabled = true;

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating ...";

    try {
        disableDeckTabs();
        const pdfBlob = await generateConstructedDeckPdf({
            decklistText: decklistTextArea?.value ?? "",
            cardDatabase,
            artLoadingOptions: getArtLoadingOptions(),
            paperSize: decklistPaperSizeSelect?.value,
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
            textBoxImportsStrings: textBoxImportsStrings,
            whiteBorder: whiteBorderCheckbox?.checked ?? false
        });

        utils.trackEvent("generate_constructed_pdf");

        downloadGeneratedPdf("cards", pdfBlob);
        await updateStatistics(`Generated PDF for Decklist.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(" Error generating PDF: ", error);
        setStatus(`Failed to generate PDF: ${message}`);
    } finally {
        generatePdfButton.textContent = originalLabel;
        enableDeckTabs();
        syncGeneratePdfButton();
    }
}

async function generateSelectedSheetPdf(): Promise<void> {
    if (!generatePdfButton) {
        return;
    }

    const selectedSheetKey = sheetRaritySelect?.value ?? "limitedRare";
    const sheetInfo = uncutSheets[selectedSheetKey as keyof typeof uncutSheets] ?? uncutSheets.limitedRare;

    const originalLabel = generatePdfButton.textContent;
    generatePdfButton.disabled = true;
    generatePdfButton.textContent = "Generating Sheet...";

    try {
        disableDeckTabs();
        const pdfBlob = await generateSheetPdf({
            cardDatabase: cardDatabase,
            artLoadingOptions: getArtLoadingOptions(),
            paperSize: "sheet",
            onProgress: setStatus,
            frameBackgroundsImportsStrings: frameBackgroundsImportsStrings,
            textBoxImportsStrings: textBoxImportsStrings,
            whiteBorder: whiteBorderCheckbox?.checked ?? false
        }, sheetInfo.cards);

        utils.trackEvent("generate_sheet_pdf", { sheet: selectedSheetKey });

        downloadGeneratedPdf(`${sheetInfo.name}-sheet`, pdfBlob, true); // 'omitDate' because those are uncut sheets which do not change over time.
        await updateStatistics(`Generated PDF for ${sheetInfo.name} sheet.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error generating sheet PDF: ", error);
        setStatus(`Failed to generate sheet PDF: ${message}`);
    } finally {
        generatePdfButton.textContent = originalLabel;
        enableDeckTabs();
        syncGeneratePdfButton();
    }
}

function disableDeckTabs(): void {
    deckTabsContainer?.classList.add("disabled");
}

function enableDeckTabs(): void {
    deckTabsContainer?.classList.remove("disabled");
}


function setStatus(message: string): void {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function setStatistics(message: string): void {
    if (statisticsElement) {
        statisticsElement.textContent = message;
    }
}

async function updateStatistics(note?: string): Promise<void> {
    const cachedArtCount = await getCachedFaceArtCount();
    const { totalCards, totalCardNames, totalFaces } = cardDatabase.stats;
    const summary = `Total cards: ${totalCards}, Card names: ${totalCardNames}, Total faces: ${totalFaces}, Cached art: ${cachedArtCount}`;
    if (note) {
        setStatus(note);
    }
    setStatistics(summary);
}

function setPreview(message: string): void {
    // Just console log the message for now.
    console.log(message);
}

// Adds a card to the preview history, capping the total size.
function pushPreviewHistory(cardName: string): void {

    // If same already at the current index, or 'touching' that index, do nothing.
    if (previewHistory[previewHistoryIndex] === cardName || previewHistory[previewHistoryIndex + 1] === cardName || previewHistory[previewHistoryIndex - 1] === cardName) {
        return;
    }

    // Insert right after the current position without discarding any forward history.
    previewHistory.splice(previewHistoryIndex + 1, 0, cardName);
    previewHistoryIndex++;

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

async function initializeArtPreferences(): Promise<void> {
    if (!highResolutionArtCheckbox || !useLocalArtDatabaseCheckbox) {
        return;
    }

    const savedHighResolution = window.localStorage.getItem(HIGH_RESOLUTION_ART_STORAGE_KEY);
    highResolutionArtCheckbox.checked = savedHighResolution === null || savedHighResolution === "true";
    useLocalArtDatabaseCheckbox.checked = window.localStorage.getItem(USE_LOCAL_ART_DATABASE_STORAGE_KEY) === "true";

    if (savedHighResolution === null) {
        // Had no saved preference, default to high resolution. also clear DB because low-resolution art might be incompatible.
        await clearCachedFaceArt();
        await updateStatistics();
    }

    setArtLoadingOptions({
        highResolution: highResolutionArtCheckbox.checked,
        useDatabase: useLocalArtDatabaseCheckbox.checked,
    });

    syncCacheOldSchoolButton();

    highResolutionArtCheckbox.addEventListener("change", () => {
        void handleHighResolutionArtChange();
    });
    useLocalArtDatabaseCheckbox.addEventListener("change", handleLocalArtDatabaseChange);
}

function syncCacheOldSchoolButton(): void {
    if (cacheOldSchoolButton) {
        cacheOldSchoolButton.disabled = !useLocalArtDatabaseCheckbox?.checked;
    }
}

async function handleHighResolutionArtChange(): Promise<void> {
    if (!highResolutionArtCheckbox || !useLocalArtDatabaseCheckbox) {
        return;
    }

    const previousOptions = getArtLoadingOptions();
    const nextHighResolution = highResolutionArtCheckbox.checked;
    if (nextHighResolution === previousOptions.highResolution) {
        return;
    }

    if (!window.confirm("Changing art resolution will clear all cached art images. Continue?")) {
        highResolutionArtCheckbox.checked = previousOptions.highResolution;
        return;
    }

    highResolutionArtCheckbox.disabled = true;
    useLocalArtDatabaseCheckbox.disabled = true;
    try {
        await clearCachedFaceArt();
        window.localStorage.setItem(HIGH_RESOLUTION_ART_STORAGE_KEY, String(nextHighResolution));
    } catch (error) {
        highResolutionArtCheckbox.checked = previousOptions.highResolution;
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to change art resolution: ${message}`);
        return;
    } finally {
        highResolutionArtCheckbox.disabled = false;
        useLocalArtDatabaseCheckbox.disabled = false;
    }

    setArtLoadingOptions({
        highResolution: nextHighResolution,
        useDatabase: previousOptions.useDatabase,
    });
    setStatus("Art resolution changed; cached art cleared.");
    await refreshCurrentPreview();
}

function handleLocalArtDatabaseChange(): void {
    if (!useLocalArtDatabaseCheckbox) {
        return;
    }

    const previousOptions = getArtLoadingOptions();
    const nextUseDatabase = useLocalArtDatabaseCheckbox.checked;
    try {
        window.localStorage.setItem(USE_LOCAL_ART_DATABASE_STORAGE_KEY, String(nextUseDatabase));
    } catch (error) {
        useLocalArtDatabaseCheckbox.checked = previousOptions.useDatabase;
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to save art database preference: ${message}`);
        return;
    }

    setArtLoadingOptions({
        highResolution: previousOptions.highResolution,
        useDatabase: nextUseDatabase,
    });
    syncCacheOldSchoolButton();
    void refreshCurrentPreview();
}

async function refreshCurrentPreview(): Promise<void> {
    const currentCard = previewController.currentCard;
    if (!currentCard) {
        return;
    }

    const query = fixQueryString(currentCard.name);

    try {
        await showCardPreview(query);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to refresh card preview: ${message}`);
    }
}

function fixQueryString(query: string): string {
    // Convert accented letters to their plain lowercase version
    query = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

    // Remove any quotes
    query = query.replace(/"/g, "");

    // replace double slash with a single slash
    query = query.replace(/\/\//g, "/");

    // Replace slash by a vertical bar
    query = query.replace(/\//g, "|");
    return query;
}


// Look for existing pack sim state in localStorage and restore it if available.
function restorePackSimState(): void {
    // There needs to be a pack sim state for each sheet of each of the packData entries
    for (const pack of packData) {
        for (const generationEntry of pack.generation) {
            const sheetKey = generationEntry.sheet;
            const raw = window.localStorage.getItem(`packSimState_${pack.key}_${sheetKey}`);
            if (!raw) {
                // default initialization for new pack sim state
                generationEntry.packSimController = new PackSimController(pack.stripSequence, 0);
            } else {
                try {
                    const parsed = JSON.parse(raw);
                    if (!parsed || typeof parsed !== "object") {
                        throw new Error("Pack sim state must be an object.");
                    }

                    const stripIndex = Number.isInteger(parsed.stripIndex) ? parsed.stripIndex : 0;
                    const stripy = Number.isInteger(parsed.stripy) ? parsed.stripy : undefined;
                    const currentX = Number.isInteger(parsed.currentX) ? parsed.currentX : undefined;
                    const currentY = Number.isInteger(parsed.currentY) ? parsed.currentY : undefined;

                    const stripSequence =
                        Array.isArray(parsed.stripSequence) &&
                            parsed.stripSequence.every((height: unknown) => Number.isInteger(height) && (height as number) > 0)
                            ? parsed.stripSequence
                            : pack.stripSequence;

                    generationEntry.packSimController = new PackSimController(stripSequence, stripIndex, stripy, currentX, currentY);
                    // console.log(`Restored PackSimController for sheet ${sheetKey} with state:`, parsed);
                } catch (error) {
                    console.error(`Failed to restore pack sim state for sheet ${sheetKey}:`, error);
                    // If restoration fails, fall back to default initialization for this pack sim state.
                    generationEntry.packSimController = new PackSimController(pack.stripSequence, 0);
                }
            }
        }
    }
}

function savePackSimState(): void {
    // Mirror the logic from restorePackSimState to save each pack sim controller's state.
    for (const pack of packData) {
        for (const generationEntry of pack.generation) {
            if (!generationEntry.packSimController) {
                continue; // Skip if there's no pack sim controller for this generation entry.
            }
            const sheetKey = generationEntry.sheet;
            const state = generationEntry.packSimController.serialize();
            window.localStorage.setItem(`packSimState_${pack.key}_${sheetKey}`, JSON.stringify(state));
        }
    }
}

function clearPackSimState(): void {
    for (const pack of packData) {
        for (const generationEntry of pack.generation) {
            if (!generationEntry.packSimController) {
                continue; // Skip if there's no pack sim controller for this generation entry.
            }
            const sheetKey = generationEntry.sheet;
            window.localStorage.removeItem(`packSimState_${pack.key}_${sheetKey}`);
        }
    }
}

function resetPacksCollationHandler(): void {
    if (!window.confirm("Reset all packs collation?")) {
        return;
    }
    //Reset any in-memory state related to pack collation.
    for (const pack of packData) {
        for (const generationEntry of pack.generation) {
            generationEntry.packSimController = new PackSimController(pack.stripSequence, 0);
        }
    }
    savePackSimState();
}

async function randomizePacks(): Promise<void> {
    if (!generatePdfButton || !window.confirm("Randomize all packs collation?")) {
        return;
    }
    generatePdfButton.disabled = true;
    disableDeckTabs();

    for (const pack of packData) {
        // Randomize by burning up packs through the pack sim controller.
        const maxBurnCount = 121 * 4300; // 1 second on a 3.4 GHz CPU

        const randomBurnCount = Math.floor(Math.random() * maxBurnCount);

        for (const generationEntry of pack.generation) {
            // Randomize by burning packs through the pack sim controller.
            for (let i = 0; i < (randomBurnCount * generationEntry.count); i++) {
                generationEntry.packSimController?.nextCardPosition();
            }
        }
        // console.log(`Randomized pack: ${pack.key} with burn count: ${randomBurnCount}`);
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }

    savePackSimState();

    enableDeckTabs();
    syncGeneratePdfButton();
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

    const previewText = await previewController.showCard(
        card,
        faces,
        cardDatabase.editions,
        cardDatabase.editionsScry,
        frameBackgroundsImageBitmap,
        textBoxImageBitmap,
        getArtLoadingOptions(),
        whiteBorderCheckbox?.checked ?? false
    );

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

function syncGeneratePdfButton(updateSealedPoolSize = false): void {
    if (decklistPaperSizeSelect) {
        decklistPaperSizeSelect.disabled = (activeDeckTab === "sheet" || activeDeckTab === "db");
    }

    if (generatePdfButton) {
        if (activeDeckTab === "sheet") {
            generatePdfButton.disabled = false;
        } else if (activeDeckTab === "sealed") {
            generatePdfButton.disabled = !Object.values(editionSelection).some(Boolean);
        } else if (activeDeckTab === "constructed") {
            generatePdfButton.disabled = (decklistTextArea?.value.trim() ?? "") === "";
        } else if (activeDeckTab === "db") {
            generatePdfButton.disabled = true;
        }
    }

    if (addToDecklistButton) {
        addToDecklistButton.disabled = previewController.currentCard === null;
    }
    if (updateSealedPoolSize) {
        if (poolSizeUpdateTimeout !== undefined) {
            clearTimeout(poolSizeUpdateTimeout);
        }
        poolSizeUpdateTimeout = window.setTimeout(updatePoolSize, 1000);
    }
}

function getLocalDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function downloadArtCacheExport(exportBlob: Blob): void {
    const downloadUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `ccg-craft-art-cache-${getLocalDateString()}.zip`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}

function downloadGeneratedPdf(title: string, pdfBlob: Blob, omitDate?: boolean): void {
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${toDownloadSlug(title)}${omitDate ? "" : `-${getLocalDateString()}`}.pdf`;
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

// Fills the sheet-rarity select with one option per uncut sheet, keyed by its uncutSheets property name.
function populateSheetRaritySelect(): void {
    if (!sheetRaritySelect) {
        return;
    }

    sheetRaritySelect.replaceChildren(); // This just clears any existing options before populating new ones.

    for (const [key, sheetInfo] of Object.entries(uncutSheets)) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = sheetInfo.name;
        sheetRaritySelect.append(option);
    }
}

// Use packData to populate #add-packs-buttons div with  buttons with an image, which add the string 'Label' to the decklist, similar to the 'power 9' button which adds the 'Power 9' to the decklist.
function populatePackSelect(): void {

    if (!addPacksButtonsContainer) {
        return;
    }

    addPacksButtonsContainer.replaceChildren(); // Clear existing buttons

    for (const pack of packData) {
        const button = document.createElement("button");
        button.type = "button";
        button.title = pack.label;
        button.classList.add("pack-image");

        const img = document.createElement("img");
        img.src = pack.image;
        img.alt = pack.label;
        img.width = 72; // Set a fixed width for the pack images, adjust as needed.
        img.height = 96; // Set a fixed height for the pack images, adjust as needed.

        button.appendChild(img);

        button.addEventListener("click", () => {
            if (decklistTextArea) {
                decklistTextArea.value += `${pack.deckEntry}\n`;
                syncGeneratePdfButton();
            }
        });

        addPacksButtonsContainer.appendChild(button);
    }
}

function updatePoolSize(): void {
    const poolSizeElement = document.getElementById("pool-size");
    if (poolSizeElement) {
        console.log(`Updating pool size...`);
        const selectedEditions = Object.entries(editionSelection)
            .filter(([, checked]) => checked)
            .map(([code]) => code);
        const text = countSealedCardPool(cardDatabase, selectedEditions);
        poolSizeElement.textContent = `from a pool of ${text} cards`;
    }
}

async function bootstrap(): Promise<void> {

    await initializeArtPreferences();

    restorePreviewHistory();
    restorePackSimState();

    populateSheetRaritySelect();
    populatePackSelect();

    try {
        await cardDatabase.load();

        if (editionCheckboxesContainer) {
            editionSelection = buildEditionCheckboxes(cardDatabase.editionsScry, editionCheckboxesContainer, syncGeneratePdfButton);
            syncGeneratePdfButton();
        }

        await updateStatistics();

        updatePoolSize();

        if (isDebug) {
            // test time to loop nextCardPosition for the PackSimController: start with a fresh controller and get a timestamp.
            const testController = new PackSimController([2, 3, 4, 4, 3, 5], 0);
            // GEt precise timestamp for debugging purposes.
            const startTime = performance.now();
            for (let i = 0; i < 25000; i++) {
                testController.nextCardPosition();
            }
            const endTime = performance.now();
            console.log(`Pack sim test start time: ${startTime}`);
            console.log(`Pack sim test end time: ${endTime}`);
            console.log(`Pack sim test duration: ${endTime - startTime} ms`);
            const stateAfter = testController.serialize();
            console.log(`Pack sim test x: ${stateAfter.currentX}, y: ${stateAfter.currentY}`);


        }

        if (isDebug) {
            // -----------------------------------------------------------------------------------
            // Test the PackSimController by generating the next card positions for a couple iterations
            // -----------------------------------------------------------------------------------
            const testController = new PackSimController([2, 3, 4, 4, 3, 5], 0);

            // The first strip is 2 rows of 11 cards, (22 cards)
            // Then the next one is 3 rows of 11 cards, (33 cards)
            // And so on, following the sequence of strip heights: 4, 4, 3, 5, and then it wraps around.
            // So looking at 56 cards, we would have gone through the first two strips completely and be partway through the third strip.
            // And looking at more than 242 cards, let's say 245, would wrap around top of some sheets.

            console.log(`Pack sim test 0: x ${testController.serialize().currentX}, y ${testController.serialize().currentY}`);

            for (let i = 0; i < 245; i++) {
                if (i && (i + 1) % 11 === 0) {
                    console.log(`passed 11 cards at iteration ${i}`);
                }
                if (i && (i + 1) % 121 === 0) {
                    console.log(`passed 121 cards at iteration ${i}`);
                }
                const position = testController.nextCardPosition();
                console.log(`Pack sim test ${i + 1}: x ${position.x}, y ${position.y}`);
            }
            // -----------------------------------------------------------------------------------
            // End of PackSimController test.
            // -----------------------------------------------------------------------------------
        }

        if (isDebug) {
            // first change one of the pack sim states
            packData[0].generation[0].packSimController?.nextCardPosition();

            // second, save the current state
            savePackSimState();

            // Last, restore and compare
            restorePackSimState();
            console.log("Restored PackSimState for all packs and sheets.");
        }
        if (isDebug) {
            console.log("Clearing PackSimState for all packs and sheets.");
            clearPackSimState();
        }

        if (lookupElement) {
            requestAnimationFrame(() => {
                lookupElement.focus({ preventScroll: true });
            });
        }

        setStatus("Ready.");

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
