import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const FACE_FILES = [
    "face-mana.txt",
    "face-names.txt",
    "face-text-lines.txt",
    "face-type-lines.txt",
];

function parseCountedTextFile(rawText, fileName) {
    const lines = rawText.split(/\r?\n/);
    const totalEntries = Number.parseInt(lines[0] ?? "", 10);

    if (!Number.isInteger(totalEntries) || totalEntries < 0) {
        throw new Error(`Invalid entry count in ${fileName}: ${lines[0] ?? "<missing>"}`);
    }

    const entries = [];

    for (let index = 1; index <= totalEntries; index += 1) {
        if (lines[index] === ".") {
            break;
        }
        entries.push(lines[index] ?? "");
    }

    if (entries.length !== totalEntries) {
        throw new Error(`Expected ${totalEntries} entries in ${fileName}, got ${entries.length}.`);
    }

    return entries;
}

function findDuplicates(entries) {
    const counts = new Map();

    for (const entry of entries) {
        counts.set(entry, (counts.get(entry) ?? 0) + 1);
    }

    return [...counts.entries()]
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([line, count]) => ({ line, count }));
}

async function checkFile(fileName) {
    const filePath = path.join(publicDir, fileName);
    const rawText = await readFile(filePath, "utf8");
    const entries = parseCountedTextFile(rawText, fileName);
    const duplicates = findDuplicates(entries);

    return {
        fileName,
        totalEntries: entries.length,
        duplicates,
    };
}

async function main() {
    const results = await Promise.all(FACE_FILES.map(checkFile));
    let hasDuplicates = false;

    for (const result of results) {
        console.log(`\n${result.fileName} (${result.totalEntries} entries)`);

        if (result.duplicates.length === 0) {
            console.log("  no duplicate lines found");
            continue;
        }

        hasDuplicates = true;
        console.log("  duplicate lines found:");

        for (const duplicate of result.duplicates) {
            console.log(`  ${duplicate.count}x ${duplicate.line}`);
        }
    }

    if (hasDuplicates) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});