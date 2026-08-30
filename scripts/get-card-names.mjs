/**
 * Fetches all unique card names for a given set code using the Scryfall API.
 * @param {string} setCode - The 3-5 character set code (e.g., 'arn', 'm21', 'neo')
 * @returns {Promise<string[]>} Array of card names
 */
async function getCardNamesBySet(setCode) {
    const cardNames = new Set();

    // Scryfall search query: e:<code` restricts search to the expansion set code
    let url = `https://api.scryfall.com/cards/search?q=set:${setCode.toLowerCase()}&unique=cards`;

    let showExample = false;

    while (url) {
        const response = await fetch(url, {
            headers: {
                // Scryfall requests a descriptive User-Agent header
                'User-Agent': 'MTGSetFetcher/1.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Set code "${setCode}" not found or has no cards.`);
            }
            throw new Error(`Scryfall API Error: ${response.statusText}`);
        }

        const json = await response.json();

        if (!showExample) {
            console.log('Example card data:', JSON.stringify(json.data[0], null, 2));
            showExample = true;
        }

        // Extract names from current page
        for (const card of json.data) {
            cardNames.add(card.name);
        }

        // Check if there is another page of results
        url = json.has_more ? json.next_page : null;

        // Be polite to Scryfall's API rate limits if paginating
        if (url) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return Array.from(cardNames);
}

// --- Usage Example ---
(async () => {
    try {
        const setCode = 'ARN'; // Arabian Nights
        console.log(`Fetching card names for set: ${setCode}...`);

        const names = await getCardNamesBySet(setCode);

        console.log(`Total Unique Cards Found: ${names.length}`);
        console.log('Sample Card Names:', names.slice(0, 10));
    } catch (err) {
        console.error('Error fetching set cards:', err.message);
    }
})();