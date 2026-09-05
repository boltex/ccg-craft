
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Note: Set, Expansion and Edition are used interchangeably in this context.

// Open default-cards-20260904210528.jsonl and reduce its contents as needed
// Were going to keep only the cards is the expansion (set) matches the ones we care about,
// and only the first occurrence if more than one card per expansion (no repeats by if card has many alternate arts per set)

// We want to build a reduced set of cards that only includes the first occurrence of each expansion from the validExpansions list.
// And the data we care about and keep is only the card name, the set, the artist name and the "art_crop" image uri

// It's jsonl so each line is a separate JSON object.

const validExpansions = [
    "PHPR",
    "PDRC",
    "2ED",
    "ARN",
    "ATQ",
    "LEG",
    "DRK",
    "FEM",
    "ICE",
    "HML",
    "ALL",
    "MIR",
    "VIS",
    "WTH",
    "TMP",
    "STH",
    "EXO",
    "USG",
    "ULG",
    "UDS",
    "MMQ",
    "NEM",
    "PCY",
    "INV",
    "PLS",
    "APC",
    "ODY",
    "TOR",
    "JUD",
    "ONS",
    "LGN",
    "SCG",
    "MRD",
    "DST",
    "5DN",
    "CHK",
    "BOK",
    "SOK",
    "POR",
    "P02",
    "PTK"
];

const validSet = new Set(validExpansions.map(e => e.toUpperCase()));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputPath = path.join(__dirname, 'default-cards-20260904210528.jsonl');

async function processCards() {
    const fileStream = fs.createReadStream(inputPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const results = {};
    let totalLines = 0;

    for await (const line of rl) {
        totalLines++;
        if (!line.trim()) continue;

        try {
            const card = JSON.parse(line);
            const cardSetUpper = (card.set || '').toUpperCase();

            if (!validSet.has(cardSetUpper)) {
                continue;
            }

            const cardName = card.name;
            const key = `${cardSetUpper}:${cardName}`;

            if (results[key]) {
                continue;
            }

            const artCrop = card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop || null;
            const artist = card.artist || card.card_faces?.[0]?.artist || null;

            results[key] = {
                artist: artist,
                art_crop: artCrop
            };
        } catch (err) {
            console.error(`Error parsing line ${totalLines}:`, err);
        }
    }

    const uniqueCount = Object.keys(results).length;
    console.log(`Processed ${totalLines} lines. Extracted ${uniqueCount} unique card entries.`);

    const outputPath = path.join(__dirname, 'reduced-default-cards.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`Saved output to ${outputPath}`);
}

processCards();



