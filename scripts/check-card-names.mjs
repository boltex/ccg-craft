import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Open all-card-names.txt for reading and checking card names
// Flag to the console if a name contains a non-alphabetic character

// Matches any character outside the printable ASCII range, e.g. accented letters like é or â.
const NON_ASCII_PATTERN = /[^\x00-\x7F]/;

async function main() {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const namesPath = path.join(scriptDir, 'all-card-names.txt');
    const content = await readFile(namesPath, 'utf8');

    const names = content.split('\n').map(line => line.trim()).filter(Boolean);
    const flaggedNames = names.filter(name => NON_ASCII_PATTERN.test(name));

    if (flaggedNames.length === 0) {
        console.log('No card names with accented or non-ASCII characters found.');
        return;
    }

    console.log(`Found ${flaggedNames.length} card name(s) with accented or non-ASCII characters:`);
    for (const name of flaggedNames) {
        console.log(name);
    }
}

main().catch(err => {
    console.error('Error checking card names:', err.message);
    process.exitCode = 1;
});

