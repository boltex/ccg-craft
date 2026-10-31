import fs from 'node:fs';
import readline from 'node:readline';
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const inputPath = path.join(__dirname, 'default-cards-20260904210528.jsonl');


const validExpansions = [
    "PHPR",
    "PDRC",
    "2ED",
    "ARN",
    "ATQ",
    "LEG",
    "DRK",
    "FEM",
    "ICE",
    "HML",
    "ALL",
    "MIR",
    "VIS",
    "WTH",
    "TMP",
    "STH",
    "EXO",
    "USG",
    "ULG",
    "UDS",
    "MMQ",
    "NEM",
    "PCY",
    "INV",
    "PLS",
    "APC",
    "ODY",
    "TOR",
    "JUD",
    "ONS",
    "LGN",
    "SCG",
    "MRD",
    "DST",
    "5DN",
    "CHK",
    "BOK",
    "SOK",
    "POR",
    "P02",
    "PTK"
];

const validSet = new Set(validExpansions.map(e => e.toUpperCase()));
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
        if (parts.length < 8) {
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

function parseFaceNames(rawText) {
    const lines = rawText.split(/\r?\n/);
    const totalEntries = Number.parseInt(lines[0] ?? "", 10);
    if (!Number.isInteger(totalEntries) || totalEntries < 0) {
        throw new Error(`Invalid entry count in face-names.txt: ${lines[0] ?? "<missing>"}`);
    }

    const entries = [];

    for (let index = 1; index <= totalEntries; index += 1) {
        if (lines[index] === ".") {
            break;
        }
        entries.push(lines[index] ?? "");
    }

    if (entries.length !== totalEntries) {
        throw new Error(`Expected ${totalEntries} entries in face-names.txt, got ${entries.length}.`);
    }
    console.log('total entries in face-names.txt:', totalEntries);
    return entries;
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

async function processDB(affectedFaces) {
    const fileStream = fs.createReadStream(inputPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const results = {};
    let totalLines = 0;

    for await (const line of rl) {
        totalLines++;
        if (!line.trim()) continue;

        // At every 250 lines, log progress
        if (totalLines % 250 === 0) {
            console.log(`Processed ${totalLines} lines so far...`);
        }

        try {
            const card = JSON.parse(line);
            const cardSetUpper = (card.set || '').toUpperCase();

            if (!validSet.has(cardSetUpper)) {
                continue;
            }

            let key = card.name.toLowerCase();

            if (results[key]) {
                continue;
            }

            const power = card.power || card.card_faces?.[0]?.power || null;
            const toughness = card.toughness || card.card_faces?.[0]?.toughness || null;
            const name = card.name || card.card_faces?.[0]?.name || null;

            // Skip cards that are not in the affectedFaces list
            if (affectedFaces.length > 0 && !affectedFaces.includes((card.name || card.card_faces?.[0]?.name || '').toLowerCase())) {
                continue;
            }


            results[key] = {
                name: name,
                power: power,
                toughness: toughness
            };
        } catch (err) {
            console.error(`Error parsing line ${totalLines}:`, err);
        }
    }

    console.log('total affected faces:', affectedFaces.length);
    console.log('total results:', Object.keys(results).length);

    return results;

}


async function main() {
    const [faceNamesRaw, singleCardsRaw, faceIndexBuffer] = await Promise.all([
        readFile(path.join(publicDir, "face-names.txt"), "utf8"),
        readFile(path.join(publicDir, "single-cards.txt"), "utf8"),
        readFile(path.join(publicDir, "face-index.dat")),
    ]);


    const cards = parseSingleCards(singleCardsRaw);
    const expectedFaceCount = Math.max(...cards.map(card => card.face2 || card.face1));
    const faces = parseFaceIndex(faceIndexBuffer);
    const faceNamesArray = parseFaceNames(faceNamesRaw);

    if (faces.length !== expectedFaceCount) {
        throw new Error(`Expected ${expectedFaceCount} faces from single-cards.txt, got ${faces.length} from face-index.dat.`);
    }

    // Check each face, if either power or toughtness is zero, increment a tally.
    let zeroPowerToughnessCount = 0;

    const affectedFaces = []; // lowercase names to compare with scryfall db face names

    // First pass, just accumulate affected faces and count zero power/toughness instances
    for (const face of faces) {
        if (face.isACreature && (face.powerToughness[0] === 0 || face.powerToughness[1] === 0)) {
            zeroPowerToughnessCount += 1;
            const faceName = faceNamesArray[face.nameIndex - 1] ?? ''; // TODO FIX faceName
            affectedFaces.push(faceName.toLowerCase());
            // console.log(`Face ${faceName} has zero power or toughness.`);
        } else {
            // do nothing for non-creature faces
        }
    }

    console.log('first loop total :', zeroPowerToughnessCount);

    // check for duplicates in affectedFaces
    const duplicates = affectedFaces.filter((item, index) => affectedFaces.indexOf(item) !== index);

    const dbData = await processDB(affectedFaces);

    let dbFoundCount = 0;
    let dbNotFoundCount = 0;
    const notFoundFaces = [];

    zeroPowerToughnessCount = 0;
    // Second pass, ask the user for each affected face if they want to replace zero power or toughness with 9999
    for (const face of faces) {
        if (face.isACreature && (face.powerToughness[0] === 0 || face.powerToughness[1] === 0)) {
            zeroPowerToughnessCount += 1;
            const faceName = faceNamesArray[face.nameIndex - 1] ?? ''; // TODO FIX faceName



            if (dbData[faceName.toLowerCase()]) {
                // const dbEntry = dbData[faceName.toLowerCase()];
                // console.log(`Found ${faceName} in the database: power ${dbEntry.power}, toughness ${dbEntry.toughness}`);
                dbFoundCount += 1;

            } else {
                notFoundFaces.push(faceName.toLowerCase());
                dbNotFoundCount += 1;
            }

            // Ask user for replacing the power or toughness if either is zero for the special value 9999.
            // Nothing leaves as is, and if user chooses 'y'/'Y', replace with 9999, which will be replaced by an asterisk when printing
            // check and ask for power first
            if (face.isACreature) {
                if (face.powerToughness[0] === 0) {
                    // Check if power is "*" in db, if so, replace with 9999 automatically
                    if (dbData[faceName.toLowerCase()] && dbData[faceName.toLowerCase()].power === '*') {
                        face.powerToughness[0] = 9999;
                        console.log(`Replaced zero power with 9999 for face ${faceName} based on database.`);
                    } else if (dbData[faceName.toLowerCase()] && dbData[faceName.toLowerCase()].power === '0') {
                        // zero leave as-is
                    } else {
                        const answer = await prompt(`Face ${faceName} has zero power. Replace with 9999? (y/N) `);
                        if (answer.toLowerCase() === 'y') {
                            face.powerToughness[0] = 9999;
                            console.log(`Replaced zero power with 9999 for face ${faceName}.`);
                        }
                    }

                }


                // Check if toughness is "*" in db, if so, replace with 9999 automatically
                if (face.powerToughness[1] === 0) {

                    if (dbData[faceName.toLowerCase()] && dbData[faceName.toLowerCase()].toughness === '*') {
                        face.powerToughness[1] = 9999;
                        console.log(`Replaced zero toughness with 9999 for face ${faceName} based on database.`);
                    } else if (dbData[faceName.toLowerCase()] && dbData[faceName.toLowerCase()].toughness === '0') {
                        // zero leave as-is
                    } else {
                        const answer = await prompt(`Face ${faceName} has zero toughness. Replace with 9999? (y/N) `);
                        if (answer.toLowerCase() === 'y') {
                            face.powerToughness[1] = 9999;
                            console.log(`Replaced zero toughness with 9999 for face ${faceName}.`);
                        }
                    }
                }
            }



        } else {
            // do nothing for non-creature faces
        }
    }



    console.log(`Found ${zeroPowerToughnessCount} faces with zero power or toughness.`);
    console.log(`Found ${dbFoundCount} faces in the database.`);
    console.log(`Did not find ${dbNotFoundCount} faces in the database.`);
    console.log(`Not found faces: ${notFoundFaces.join(', ')}`);

    console.log(`Checked ${faces.length} faces against single-cards.txt.`);

    // Dry run test
    const output = serializeFaceIndex(faces);
    await writeFile(path.join(publicDir, "face-index-dry-run.dat"), output);
    console.log(`Rebuilt public/face-index-dry-run.dat with ${faces.length} faces.`);


}

void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});