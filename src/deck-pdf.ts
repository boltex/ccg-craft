import * as constants from "./constants";
import { CardDatabase } from "./card-database";
import { parseDecklistText } from "./decklist";
import { prepareFaceArtForCard } from "./art-loader";
import { generateDeckPdf } from "./pdf-export";
import type { Card } from "./types";

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
        card => selectedEditions.includes(card.edition) && !constants.BasicLandNames.includes(card.name)
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
                background: "#000000"
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
};

export async function generateConstructedDeckPdf(input: GenerateConstructedDeckPdfInput): Promise<Blob> {
    const decklistEntries = parseDecklistText(input.decklistText);

    const decklistCards: Card[] = [];
    for (const { quantity, cardName } of decklistEntries) {
        const serial = input.cardDatabase.findCardSerialByNamePrefix(cardName);
        if (serial === undefined) {
            console.log(`No card found starting with "${cardName}".`);
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
                background: "#000000"
            }
        },
        input.onProgress
    );
}
