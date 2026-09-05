
/*

    Rebuild single cards using the provided data files to generate updated card information.
    The new data to add is the artist name and the artwork URL.

    The old format looked like this :// lines look like this:
    CardSerial, Face1Serial, Face2Serial, Edition, Name
    e.g.: 
    4174, 4174, 0, IN, Artifact Mutation

    The new format will include the artist name and artwork URL:
    CardSerial, Face1Serial, Face2Serial, Edition, Artist, ArtworkURL, Name
    e.g.:
    4174, 4174, 0, IN, John Doe, http://example.com/artwork.jpg, Artifact Mutation

    Note: The Name is placed last because it may contain commas, and placing it last ensures correct parsing.

    To convert the old single-cards.txt edition code to the scryfall set code, use the selectScryfallEdition function with the list of available Scryfall editions for each card.

    save to ../public/single-cards-updated.txt

*/
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");




// TODO:
// 1- Get the list of single cards to rebuild ( ../public/single-cards.txt)
// 2- Get the editions-scry.json ( ../public/editions-scry.json) to be able to convert editions to scryfall set abbreviations (also using selectScryfallEdition)
// 3- Get the art-data.json file loaded ( ../public/art-data.json)
const singleCards = [];
const editionsScry = {};
const artData = {};


// Fetch single-cards.txt and parse it
let response = await fetch("../public/single-cards.txt");
if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
}
let text = await response.text();
singleCards.push(...parseSingleCards(text));

// Fetch editions-scry.json and parse it
response = await fetch("../public/editions-scry.json");
if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
}
text = await response.text();
Object.assign(editionsScry, JSON.parse(text));

// Fetch art-data.json and parse it
response = await fetch("../public/art-data.json");
if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
}
text = await response.text();
Object.assign(artData, JSON.parse(text));

console.log("Total single cards:", singleCards.length, "Editions Scry:", Object.keys(editionsScry).length, "Art Data:", Object.keys(artData).length);


// Utility functions
function selectScryfallEdition(cardName, scryfallEditions) {
    if (scryfallEditions.length === 0) {
        throw new Error(`No Scryfall editions available for ${cardName}.`);
    }

    if (cardName === "Nalathni Dragon" && scryfallEditions.includes("PDRC")) {
        return "PDRC";
    }

    return scryfallEditions[0]; // a string representing the selected Scryfall edition
}

function parseSingleCards(rawText) {
    const lines = rawText.split(/\r?\n/);
    const result = [];
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