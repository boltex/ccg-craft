// One-shot maintenance utility.
// Removes duplicate lines from public/face-mana.txt (keeping the first
// occurrence of each), then rewrites public/face-index.dat so every face's
// manaCostIndex points at the correct (renumbered) line.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

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

function serializeCountedTextFile(entries) {
    return [String(entries.length), ...entries, "."].join("\r\n");
}

function parseSingleCards(rawText) {
    const lines = rawText.split(/\r?\n/);
    const cards = [];

    for (const line of lines) {
        if (line === ".") {
            break;
        }
        if (!line.trim()) {
            continue;
        }

        const parts = line.split(",");
        if (parts.length < 5) {
            throw new Error(`Malformed single card line: ${line}`);
        }

        cards.push({
            serial: Number.parseInt(parts[0].trim(), 10),
            face1: Number.parseInt(parts[1].trim(), 10),
            face2: Number.parseInt(parts[2].trim(), 10),
        });
    }

    return cards;
}

function readUint32(buffer, offset) {
    return buffer.readUInt32LE(offset);
}

function parseFaceIndex(buffer) {
    const faces = [];
    let offset = 0;

    while (offset < buffer.length) {
        if (offset + 32 > buffer.length) {
            throw new Error(`Truncated face-index.dat near byte ${offset}.`);
        }

        const face = {
            faceSerial: readUint32(buffer, offset),
            parentCard: readUint32(buffer, offset + 4),
            faceType: readUint32(buffer, offset + 8),
            edition: readUint32(buffer, offset + 12),
            nameIndex: readUint32(buffer, offset + 16),
            manaCostIndex: readUint32(buffer, offset + 20),
            typeLineIndex: readUint32(buffer, offset + 24),
            isACreature: readUint32(buffer, offset + 28) !== 0,
            powerToughness: [],
            textLines: [],
        };
        offset += 32;

        if (face.isACreature) {
            if (offset + 8 > buffer.length) {
                throw new Error(`Truncated power/toughness near byte ${offset}.`);
            }
            face.powerToughness = [
                readUint32(buffer, offset),
                readUint32(buffer, offset + 4),
            ];
            offset += 8;
        }

        if (offset + 4 > buffer.length) {
            throw new Error(`Truncated text count near byte ${offset}.`);
        }

        const numText = readUint32(buffer, offset);
        offset += 4;

        if (offset + numText * 4 > buffer.length) {
            throw new Error(`Truncated text indexes near byte ${offset}.`);
        }

        for (let index = 0; index < numText; index += 1) {
            face.textLines.push(readUint32(buffer, offset));
            offset += 4;
        }

        faces.push(face);
    }

    return faces;
}

function serializeFaceIndex(faces) {
    const buffers = [];

    for (const face of faces) {
        const header = Buffer.alloc(face.isACreature ? 44 : 36);
        let offset = 0;

        header.writeUInt32LE(face.faceSerial, offset);
        offset += 4;
        header.writeUInt32LE(face.parentCard, offset);
        offset += 4;
        header.writeUInt32LE(face.faceType, offset);
        offset += 4;
        header.writeUInt32LE(face.edition, offset);
        offset += 4;
        header.writeUInt32LE(face.nameIndex, offset);
        offset += 4;
        header.writeUInt32LE(face.manaCostIndex, offset);
        offset += 4;
        header.writeUInt32LE(face.typeLineIndex, offset);
        offset += 4;
        header.writeUInt32LE(face.isACreature ? 1 : 0, offset);
        offset += 4;

        if (face.isACreature) {
            header.writeUInt32LE(face.powerToughness[0] ?? 0, offset);
            offset += 4;
            header.writeUInt32LE(face.powerToughness[1] ?? 0, offset);
            offset += 4;
        }

        header.writeUInt32LE(face.textLines.length, offset);
        buffers.push(header);

        if (face.textLines.length > 0) {
            const textBuffer = Buffer.alloc(face.textLines.length * 4);
            for (let index = 0; index < face.textLines.length; index += 1) {
                textBuffer.writeUInt32LE(face.textLines[index], index * 4);
            }
            buffers.push(textBuffer);
        }
    }

    return Buffer.concat(buffers);
}

// Deduplicates entries (keeping first occurrence) and returns the new list
// plus a map from old 1-based index to new 1-based index.
function dedupeEntries(entries) {
    const dedupedEntries = [];
    const firstIndexByValue = new Map();
    const oldToNewIndex = new Map();

    entries.forEach((entry, entryIndex) => {
        const oldIndex = entryIndex + 1;

        if (firstIndexByValue.has(entry)) {
            oldToNewIndex.set(oldIndex, firstIndexByValue.get(entry));
            return;
        }

        dedupedEntries.push(entry);
        const newIndex = dedupedEntries.length;
        firstIndexByValue.set(entry, newIndex);
        oldToNewIndex.set(oldIndex, newIndex);
    });

    return { dedupedEntries, oldToNewIndex };
}

async function main() {
    const [manaLinesRaw, singleCardsRaw, faceIndexBuffer] = await Promise.all([
        readFile(path.join(publicDir, "face-mana.txt"), "utf8"),
        readFile(path.join(publicDir, "single-cards.txt"), "utf8"),
        readFile(path.join(publicDir, "face-index.dat")),
    ]);

    const manaLines = parseCountedTextFile(manaLinesRaw, "face-mana.txt");
    const cards = parseSingleCards(singleCardsRaw);
    const expectedFaceCount = Math.max(...cards.map(card => card.face2 || card.face1));
    const faces = parseFaceIndex(faceIndexBuffer);

    if (faces.length !== expectedFaceCount) {
        throw new Error(`Expected ${expectedFaceCount} faces from single-cards.txt, got ${faces.length} from face-index.dat.`);
    }

    const { dedupedEntries, oldToNewIndex } = dedupeEntries(manaLines);
    const removedCount = manaLines.length - dedupedEntries.length;

    if (removedCount === 0) {
        console.log("No duplicate lines found in face-mana.txt, nothing to do.");
        return;
    }

    let patchedFaces = 0;

    for (const face of faces) {
        if (face.manaCostIndex === 0) {
            continue;
        }

        const newIndex = oldToNewIndex.get(face.manaCostIndex);
        if (newIndex === undefined) {
            throw new Error(`Face ${face.faceSerial} has out-of-range manaCostIndex ${face.manaCostIndex}.`);
        }

        if (newIndex !== face.manaCostIndex) {
            face.manaCostIndex = newIndex;
            patchedFaces += 1;
        }
    }

    await Promise.all([
        writeFile(path.join(publicDir, "face-mana.txt"), serializeCountedTextFile(dedupedEntries)),
        writeFile(path.join(publicDir, "face-index.dat"), serializeFaceIndex(faces)),
    ]);

    console.log(`Removed ${removedCount} duplicate line(s) from face-mana.txt (${manaLines.length} -> ${dedupedEntries.length}).`);
    console.log(`Repointed ${patchedFaces} face manaCostIndex value(s) in face-index.dat.`);
}

void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
