
// One-shot maintenance utility kept for reference.
// This was used to rewrite public/face-index.dat with baked-in land mana text
// for basic lands and original dual lands, and does not need to be run during
// normal development unless the binary asset must be regenerated again.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const BASIC_LAND_RULES = new Map([
    ["Forest", "{T}: Add {G} to your mana pool."],
    ["Island", "{T}: Add {U} to your mana pool."],
    ["Mountain", "{T}: Add {R} to your mana pool."],
    ["Plains", "{T}: Add {W} to your mana pool."],
    ["Swamp", "{T}: Add {B} to your mana pool."],
]);

function parseCountedTextFile(rawText) {
    const lines = rawText.split(/\r?\n/);
    const totalEntries = Number.parseInt(lines[0] ?? "", 10);
    const entries = [];

    for (let index = 1; index <= totalEntries; index += 1) {
        if (lines[index] === ".") {
            break;
        }
        entries.push(lines[index] ?? "");
    }

    if (entries.length !== totalEntries) {
        throw new Error(`Expected ${totalEntries} entries, got ${entries.length}.`);
    }

    return entries;
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

function addMissingBasicLandRules(faces, typeLines, textLines) {
    const textIndexByRule = new Map();
    for (const [landType, ruleText] of BASIC_LAND_RULES.entries()) {
        const index = textLines.indexOf(ruleText);
        if (index === -1) {
            throw new Error(`Missing rules text for ${landType}: ${ruleText}`);
        }
        textIndexByRule.set(landType, index + 1);
    }

    let patchedFaces = 0;

    for (const face of faces) {
        const typeLine = typeLines[face.typeLineIndex - 1] ?? "";
        if (!typeLine.includes("Land")) {
            continue;
        }

        for (const [landType, textIndex] of textIndexByRule.entries()) {
            if (!typeLine.includes(landType)) {
                continue;
            }
            if (!face.textLines.includes(textIndex)) {
                face.textLines.push(textIndex);
                patchedFaces += 1;
            }
        }
    }

    return patchedFaces;
}

async function main() {
    const [typeLinesRaw, textLinesRaw, singleCardsRaw, faceIndexBuffer] = await Promise.all([
        readFile(path.join(publicDir, "face-type-lines.txt"), "utf8"),
        readFile(path.join(publicDir, "face-text-lines.txt"), "utf8"),
        readFile(path.join(publicDir, "single-cards.txt"), "utf8"),
        readFile(path.join(publicDir, "face-index.dat")),
    ]);

    const typeLines = parseCountedTextFile(typeLinesRaw);
    const textLines = parseCountedTextFile(textLinesRaw);
    const cards = parseSingleCards(singleCardsRaw);
    const expectedFaceCount = Math.max(...cards.map(card => card.face2 || card.face1));
    const faces = parseFaceIndex(faceIndexBuffer);

    if (faces.length !== expectedFaceCount) {
        throw new Error(`Expected ${expectedFaceCount} faces from single-cards.txt, got ${faces.length} from face-index.dat.`);
    }

    const patchedFaces = addMissingBasicLandRules(faces, typeLines, textLines);
    const output = serializeFaceIndex(faces);

    await writeFile(path.join(publicDir, "face-index.dat"), output);

    console.log(`Rebuilt public/face-index.dat with ${faces.length} faces.`);
    console.log(`Patched ${patchedFaces} basic land face records.`);
}

void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});