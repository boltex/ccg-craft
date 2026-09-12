
/*

    Rebuild single cards using the provided data files to generate updated card information.
    
    The old format looked like this :// lines look like this:
    CardSerial, Face1Serial, Face2Serial, Edition, Artist index, ArtworkURL, Name
    e.g.:
    4174, 4174, 0, IN, 181, d/5/d5eef49c-a80f-4622-ba77-999f9151c841.jpg?1783945666, Artifact Mutation


    The new format will include the flavor text as an index (1 based because 0 means none) like so:
    CardSerial, Face1Serial, Face2Serial, Edition, Artist index, ArtworkURL, FlavorText index, Name
    e.g.:
    4174, 4174, 0, IN, 181, d/5/d5eef49c-a80f-4622-ba77-999f9151c841.jpg?1783945666, 1, Artifact Mutation
    


    Note: The Name is placed last because it may contain commas, and placing it last ensures correct parsing.

    To convert the single-cards-old-2.txt edition code to the scryfall set code, use the selectScryfallEdition function with the list of available Scryfall editions for each card.

    save to ../public/single-cards-updated.txt

*/
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const singleCards = [];
const editionsScry = {};
const flavorData = {};
const flavorTexts = [];

// Read scripts/single-cards-old.txt and parse it
let text = await readFile(path.join(__dirname, "single-cards-old-2.txt"), "utf-8");
singleCards.push(...parseSingleCards(text));

console.log('Total single cards loaded:', singleCards.length);

// Read editions.json and parse it
text = await readFile(path.join(publicDir, "editions.json"), "utf-8");
Object.assign(editionsScry, JSON.parse(text));

// Read reduced-default-cards-flavor.json and parse it
text = await readFile(path.join(__dirname, "reduced-default-cards-flavor.json"), "utf-8");
Object.assign(flavorData, JSON.parse(text));

console.log("Total single cards:", singleCards.length, "Editions Scry:", Object.keys(editionsScry).length, "Flavor Data:", Object.keys(flavorData).length);

const updatedSingleCards = [];

// Main loop
for (const card of singleCards) {
    const scryfallEdition = selectScryfallEdition(card.name, editionsScry[card.edition].scry || []);

    // The key should be scryfall set column card name such as "ARN:Shahrazad".
    let flavorDataKey = `${scryfallEdition}:${card.name}`;
    // Replace  |  with //
    flavorDataKey = flavorDataKey.replace(/\|/g, "//");
    // Replace AE with Ae
    flavorDataKey = flavorDataKey.replace(/AE/g, "Ae");

    const flavorInfo = flavorData[flavorDataKey] || {};
    let flavorText = flavorInfo.f || "";

    // make flavorText a json string to keep is all on one line 
    if (flavorText) {
        // if not an empty string, convert it to a JSON string
        flavorText = JSON.stringify(flavorText);
    }

    if (flavorText && !flavorTexts.includes(flavorText)) {
        flavorTexts.push(flavorText);
    }

    let flavorIndex = 0;  // 0 means none, the index will be 1 based.
    if (flavorText) {
        flavorIndex = flavorTexts.indexOf(flavorText);
        if (flavorIndex === -1) {
            console.log(`Flavor text not found in flavorTexts array: "${flavorText}"`);
        }
        flavorIndex = flavorIndex + 1; // convert to 1-based index
    }


    updatedSingleCards.push({
        serial: card.serial,
        face1: card.face1,
        face2: card.face2,
        edition: card.edition,
        artist: card.artist,
        artworkURL: card.artworkURL,
        flavor: flavorIndex,
        name: card.name
    });



}


if (updatedSingleCards.length > 0) {
    // Ok, missing info is zero, we can proceed with updatedSingleCards

    // save to ../public/single-cards-updated.txt
    /* 
    The new format will include the flavor text as an index (1 based because 0 means none) like so:
    CardSerial, Face1Serial, Face2Serial, Edition, Artist index, ArtworkURL, FlavorText index, Name
    e.g.:
    4174, 4174, 0, IN, 21, http://example.com/artwork.jpg, 1, Artifact Mutation
    */
    const lines = updatedSingleCards.map(card => {
        return `${card.serial}, ${card.face1}, ${card.face2}, ${card.edition}, ${card.artist}, ${card.artworkURL}, ${card.flavor}, ${card.name}`;
    });
    await writeFile(path.join(publicDir, "single-cards-updated.txt"), lines.join("\n"), "utf-8");
    console.log(`Updated single cards saved to ${path.join(publicDir, "single-cards-updated.txt")}`);

    await writeFile(path.join(publicDir, "flavor.txt"), `${flavorTexts.length}\n${flavorTexts.join("\n")}`, "utf-8");
    console.log(`flavor saved to ${path.join(publicDir, "flavor.txt")}`);


}



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

        // 4174, 4174, 0, IN, 181, d/5/d5eef49c-a80f-4622-ba77-999f9151c841.jpg?1783945666, Artifact Mutation
        const parts = lines[i].split(",");
        if (parts.length < 6) {
            console.warn(`Skipping malformed line: ${lines[i]}`);
            throw new Error(`Malformed line in single-cards.txt: ${lines[i]}`);
        }
        const serial = parseInt(parts[0].trim(), 10);
        const face1 = parseInt(parts[1].trim(), 10);
        const face2 = parseInt(parts[2].trim(), 10);
        const edition = parts[3].trim();
        const artist = parseInt(parts[4].trim(), 10);
        const artworkURL = parts[5].trim();
        const name = parts.slice(6).join(",").trim();

        result.push({ serial, face1, face2, edition, artist, artworkURL, name });
    }

    return result;
}