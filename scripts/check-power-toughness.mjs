
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

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

async function main() {
    const [singleCardsRaw, faceIndexBuffer] = await Promise.all([
        readFile(path.join(publicDir, "single-cards.txt"), "utf8"),
        readFile(path.join(publicDir, "face-index.dat")),
    ]);


    const cards = parseSingleCards(singleCardsRaw);
    const expectedFaceCount = Math.max(...cards.map(card => card.face2 || card.face1));
    const faces = parseFaceIndex(faceIndexBuffer);

    if (faces.length !== expectedFaceCount) {
        throw new Error(`Expected ${expectedFaceCount} faces from single-cards.txt, got ${faces.length} from face-index.dat.`);
    }

    console.log(`Checked ${faces.length} faces against single-cards.txt.`);
}

void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});