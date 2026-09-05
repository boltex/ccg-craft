
/*

    Rebuild single cards using the provided data files to generate updated card information.
    
    The old format looked like this :// lines look like this:
    CardSerial, Face1Serial, Face2Serial, Edition, Name
    e.g.: 
    4174, 4174, 0, IN, Artifact Mutation

    The new format will include the artist index (we also generate an artists list) and artwork URL:
    CardSerial, Face1Serial, Face2Serial, Edition, Artist index, ArtworkURL, Name
    e.g.:
    4174, 4174, 0, IN, 21, http://example.com/artwork.jpg, Artifact Mutation

    Note: The Name is placed last because it may contain commas, and placing it last ensures correct parsing.

    To convert the single-cards-old.txt edition code to the scryfall set code, use the selectScryfallEdition function with the list of available Scryfall editions for each card.

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
const artData = {};
const artists = [];

// Read scripts/single-cards-old.txt and parse it
let text = await readFile(path.join(__dirname, "single-cards-old.txt"), "utf-8");
singleCards.push(...parseSingleCards(text));

console.log('Total single cards loaded:', singleCards.length);

// Read editions-scry.json and parse it
text = await readFile(path.join(publicDir, "editions-scry.json"), "utf-8");
Object.assign(editionsScry, JSON.parse(text));

// Read art-data.json and parse it
text = await readFile(path.join(publicDir, "art-data.json"), "utf-8");
Object.assign(artData, JSON.parse(text));

console.log("Total single cards:", singleCards.length, "Editions Scry:", Object.keys(editionsScry).length, "Art Data:", Object.keys(artData).length);
let totalMissingArtInfo = 0;

const updatedSingleCards = [];

// Main loop
for (const card of singleCards) {
    const scryfallEdition = selectScryfallEdition(card.name, editionsScry[card.edition] || []);

    // The key should be scryfall set column card name such as "ARN:Shahrazad".
    let artDataKey = `${scryfallEdition}:${card.name}`;
    // Replace  |  with //
    artDataKey = artDataKey.replace(/\|/g, "//");
    // Replace AE with Ae
    artDataKey = artDataKey.replace(/AE/g, "Ae");

    const artInfo = artData[artDataKey] || {};
    const artist = artInfo.a || "";
    if (artist && !artists.includes(artist)) {
        artists.push(artist);
    }
    const artistIndex = artists.indexOf(artist);

    const artworkURL = artInfo.b || "";

    if (['CHK', 'BOK', 'SOK'].includes(scryfallEdition)) {
        // Trim all after, and including  " //"
        artDataKey = artDataKey.split(" //")[0];
    }

    if (!artist || !artworkURL) {
        console.warn(`Missing art info for card: ${card.name}, Edition: ${scryfallEdition}, Art Data Key: ${artDataKey}`);
        totalMissingArtInfo++;
    }

    updatedSingleCards.push({
        serial: card.serial,
        face1: card.face1,
        face2: card.face2,
        edition: card.edition,
        artist: artistIndex,
        artworkURL,
        name: card.name
    });

}

console.log("Total missing art info:", totalMissingArtInfo);

if (updatedSingleCards.length > 0 && totalMissingArtInfo === 0) {
    // Ok, missing art info is zero, we can proceed with updatedSingleCards

    // save to ../public/single-cards-updated.txt
    /* 
    The new format will include the artist name and artwork URL:
    CardSerial, Face1Serial, Face2Serial, Edition, Artist, ArtworkURL, Name
    e.g.:
    4174, 4174, 0, IN, John Doe, http://example.com/artwork.jpg, Artifact Mutation
    */
    const lines = updatedSingleCards.map(card => {
        return `${card.serial}, ${card.face1}, ${card.face2}, ${card.edition}, ${card.artist}, ${card.artworkURL}, ${card.name}`;
    });
    await writeFile(path.join(publicDir, "single-cards-updated.txt"), lines.join("\n"), "utf-8");
    console.log(`Updated single cards saved to ${path.join(publicDir, "single-cards-updated.txt")}`);

    // save the artists array to ../public/artists.txt
    // But start the artists file with the total on the first line
    await writeFile(path.join(publicDir, "artists.txt"), `${artists.length}\n${artists.join("\n")}`, "utf-8");
    console.log(`Artists saved to ${path.join(publicDir, "artists.txt")}`);

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