import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchCardsPage(url, setCode) {
    while (true) {
        const response = await fetch(url, {
            headers: {
                // Scryfall requests a descriptive User-Agent header
                'User-Agent': 'ccg-craft/1.0 (card name fetcher)',
                'Accept': 'application/json'
            }
        });

        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? '1', 10);
            const retryDelayMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000;

            console.log(`Rate limited while fetching ${setCode}; retrying in ${retryDelayMs}ms...`);
            await sleep(retryDelayMs);
            continue;
        }

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Set code "${setCode}" not found or has no cards.`);
            }
            throw new Error(`Scryfall API Error: ${response.statusText}`);
        }

        return response.json();
    }
}
/**
 * Fetches all unique card names for a given set code using the Scryfall API.
 * @param {string} setCode - The 3-5 character set code (e.g., 'arn', 'm21', 'neo')
 * @returns {Promise<string[]>} Array of card names
 */
async function getCardNamesBySet(setCode) {
    const cardNames = new Set();

    // Scryfall search query: e:<code` restricts search to the expansion set code
    let url = `https://api.scryfall.com/cards/search?q=set:${setCode.toLowerCase()}&unique=cards`;

    while (url) {
        const json = await fetchCardsPage(url, setCode);

        for (const card of json.data) {
            cardNames.add(card.name);
        }

        // Check if there is another page of results
        url = json.has_more ? json.next_page : null;

        // Be polite to Scryfall's API rate limits if paginating
        if (url) {
            await sleep(125);
        }
    }

    return Array.from(cardNames);
}

async function getEditionSetCodes() {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const editionsPath = path.resolve(scriptDir, '../public/editions-scry.json');
    const editionsJson = await readFile(editionsPath, 'utf8');
    const editions = JSON.parse(editionsJson);

    return [...new Set(Object.values(editions).flat())];
}

async function writeCardNamesFile(cardNames) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const outputPath = path.join(scriptDir, 'all-card-names.txt');
    const content = `${cardNames.join('\n')}\n`;

    await writeFile(outputPath, content, 'utf8');

    return outputPath;
}

(async () => {
    try {
        const setCodes = await getEditionSetCodes();
        const allCardNames = new Set();

        for (const setCode of setCodes) {
            await sleep(125);
            console.log(`Fetching card names for set: ${setCode}...`);

            const names = await getCardNamesBySet(setCode);

            for (const name of names) {
                allCardNames.add(name);
            }
        }

        const sortedCardNames = Array.from(allCardNames).sort((left, right) => left.localeCompare(right));
        const outputPath = await writeCardNamesFile(sortedCardNames);

        console.log(`Saved ${sortedCardNames.length} unique card names to ${outputPath}`);
    } catch (err) {
        console.error('Error fetching set cards:', err.message);
        process.exitCode = 1;
    }
})();