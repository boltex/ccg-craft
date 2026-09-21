import * as constants from "./constants";
import { CardDatabase } from "./card-database";
import { parseDecklistText } from "./decklist";
import { prepareFaceArtForCard } from "./art-loader";
import { generateDeckPdf } from "./pdf-export";
import type { Card } from "./types";
import { packData } from "./pack-sim";

async function preloadCardArtForCards(
    cards: Card[],
    cardDatabase: CardDatabase,
    logFunction?: (message: string) => void
): Promise<void> {
    let cardCounter = 0;
    for (const card of cards) {
        if (logFunction) {
            logFunction(`Preloading art: ${++cardCounter}/${cards.length}`);
        }

        const faces = cardDatabase.getFaceData(card.serial);
        await prepareFaceArtForCard({ card, faces });
    }
}

// Builds the deduplicated pool of cards eligible for a sealed pack from the selected editions.
export function selectSealedCardPool(cardDatabase: CardDatabase, selectedEditions: string[]): Card[] {
    const availableCards = cardDatabase.singleCards.filter(
        // Also check for BasicLandNames card name without the last possible 'digit' character of alternate art cards.
        card => selectedEditions.includes(card.edition) && !constants.BasicLandNames.includes(card.name) && !constants.BasicLandNames.includes(card.name.slice(0, -1))
    );

    // Keep the first occurrence of each card name for easy lookup.
    const availableCardsDict: Record<string, Card> = {};
    for (const card of availableCards) {
        if (!availableCardsDict[card.name]) {
            availableCardsDict[card.name] = card;
        }
    }

    return Object.values(availableCardsDict);
}

export type GenerateSealedDeckPdfInput = {
    cardPool: Card[];
    cardDatabase: CardDatabase;
    paperSize?: string;
    onProgress?: (message: string) => void;
    frameBackgroundsImportsStrings: Record<string, string>;
    textBoxImportsStrings: Record<string, string>;
};

export async function generateSealedDeckPdf(input: GenerateSealedDeckPdfInput): Promise<Blob> {
    const sealedDeckCards: Card[] = [];
    while (sealedDeckCards.length < constants.sealedDeckSize) {
        const randomIndex = Math.floor(Math.random() * input.cardPool.length);
        sealedDeckCards.push(input.cardPool[randomIndex]);
    }

    await preloadCardArtForCards(sealedDeckCards, input.cardDatabase, input.onProgress);

    return generateDeckPdf(
        {
            cards: sealedDeckCards,
            paperSize: input.paperSize,
            getFaceData: cardSerial => input.cardDatabase.getFaceData(cardSerial),
            renderOptions: {
                padding: 5,
                background: "#000000",
                frameBackgroundsImportsStrings: input.frameBackgroundsImportsStrings,
                textBoxImportsStrings: input.textBoxImportsStrings,
            },
        },
        input.onProgress
    );
}

export type GenerateConstructedDeckPdfInput = {
    decklistText: string;
    cardDatabase: CardDatabase;
    paperSize?: string;
    onProgress?: (message: string) => void;
    frameBackgroundsImportsStrings: Record<string, string>;
    textBoxImportsStrings: Record<string, string>;
};

export async function generateConstructedDeckPdf(input: GenerateConstructedDeckPdfInput): Promise<Blob> {
    const decklistEntries = parseDecklistText(input.decklistText);

    const decklistCards: Card[] = [];
    for (const { quantity, cardName } of decklistEntries) {
        // 1 - todo: First, if we match a booster pack or starter pack name,
        //     then generate the card serials and push them to decklistCards (also honor quantity)
        let packMatched = false;
        for (const pack of packData) {
            if (cardName === pack.deckEntry) {
                for (let i = 0; i < quantity; i++) {

                    // Todo: call function to generate card serials for the pack and push them to decklistCards
                }
                packMatched = true;
                break; // no need to check other packs if we found a match
            }
        }

        if (packMatched) {
            continue; // No need to try matching by name prefix if we matched a pack
        }

        // 2- else, try to match a card by name prefix
        const serial = input.cardDatabase.findCardSerialByNamePrefix(cardName);
        if (serial === undefined) {
            console.log(`No card found starting with "${cardName}".`);
            // The line was neither a pack nor a card match
            continue;
        }

        const card = input.cardDatabase.getCardBySerial(serial);
        for (let i = 0; i < quantity; i++) {
            decklistCards.push(card);
        }
    }

    if (decklistCards.length > constants.maxCardsInDeck) {
        throw new Error(`Decklist is too big: ${decklistCards.length} cards (max ${constants.maxCardsInDeck}).`);
    }

    await preloadCardArtForCards(decklistCards, input.cardDatabase, input.onProgress);

    return generateDeckPdf(
        {
            cards: decklistCards,
            getFaceData: cardSerial => input.cardDatabase.getFaceData(cardSerial),
            paperSize: input.paperSize,
            renderOptions: {
                padding: 5,
                background: "#000000",
                frameBackgroundsImportsStrings: input.frameBackgroundsImportsStrings,
                textBoxImportsStrings: input.textBoxImportsStrings,
            },
        },
        input.onProgress
    );
}

export type UncutSheetDeckPdfInput = {
    cardDatabase: CardDatabase;
    paperSize?: string;
    onProgress?: (message: string) => void;
    frameBackgroundsImportsStrings: Record<string, string>;
    textBoxImportsStrings: Record<string, string>;
};

// Unused - kept as reference or for potential future use
export async function generateSheetPdfFromStrings(input: UncutSheetDeckPdfInput, cardNames: string[]): Promise<Blob> {

    const sheetCards: Card[] = [];
    for (const cardName of cardNames) {
        const cleanedCardName = cardName
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .toLowerCase();

        const serial = input.cardDatabase.findCardSerialByNamePrefix(cleanedCardName);
        if (serial == null) {
            console.log(`No card found starting with "${cardName}".`);
            continue;
        }

        const card = input.cardDatabase.getCardBySerial(serial);
        sheetCards.push(card);
    }

    console.log('Sheet card serials', sheetCards.map(card => card.serial));

    await preloadCardArtForCards(sheetCards, input.cardDatabase, input.onProgress);

    return generateDeckPdf(
        {
            cards: sheetCards, // Replace with the actual cards for the sheet
            getFaceData: cardSerial => input.cardDatabase.getFaceData(cardSerial),
            paperSize: input.paperSize,
            renderOptions: {
                padding: 5,
                background: "#000000",
                frameBackgroundsImportsStrings: input.frameBackgroundsImportsStrings,
                textBoxImportsStrings: input.textBoxImportsStrings,
            },
        },
        input.onProgress
    );
}

export async function generateSheetPdf(input: UncutSheetDeckPdfInput, cardSerials: number[]): Promise<Blob> {

    const sheetCards: Card[] = [];
    for (const serial of cardSerials) {
        if (serial == null) {
            console.log(`No card found for serial "${serial}".`);
            continue;
        }

        const card = input.cardDatabase.getCardBySerial(serial);
        sheetCards.push(card);
    }

    await preloadCardArtForCards(sheetCards, input.cardDatabase, input.onProgress);

    return generateDeckPdf(
        {
            cards: sheetCards, // Replace with the actual cards for the sheet
            getFaceData: cardSerial => input.cardDatabase.getFaceData(cardSerial),
            paperSize: input.paperSize,
            renderOptions: {
                padding: 5,
                background: "#000000",
                frameBackgroundsImportsStrings: input.frameBackgroundsImportsStrings,
                textBoxImportsStrings: input.textBoxImportsStrings,
            },
        },
        input.onProgress
    );
}