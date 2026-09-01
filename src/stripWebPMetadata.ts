function readFourCC(
    bytes: Uint8Array,
    offset: number,
): string {
    return String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    );
}

function writeUint32LE(
    bytes: Uint8Array,
    offset: number,
    value: number,
): void {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
}

function concatUint8Arrays(
    chunks: Uint8Array[],
): Uint8Array {
    let total = 0;

    for (const chunk of chunks) {
        total += chunk.length;
    }

    const result = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

export async function stripWebPMetadata(
    blob: Blob,
): Promise<Blob> {
    const source = new Uint8Array(await blob.arrayBuffer());

    if (source.length < 12) {
        throw new Error('Invalid WebP: file too small.');
    }

    if (
        readFourCC(source, 0) !== 'RIFF' ||
        readFourCC(source, 8) !== 'WEBP'
    ) {
        throw new Error('Invalid WebP: missing RIFF/WEBP header.');
    }

    const strippedChunkTypes = new Set([
        'ICCP',
        'EXIF',
        'XMP ',
    ]);

    const outputChunks: Uint8Array[] = [];

    // Copy RIFF + size placeholder + WEBP
    const header = source.slice(0, 12);
    outputChunks.push(header);

    let offset = 12;
    let strippedChunkCount = 0;
    let strippedByteCount = 0;

    while (offset + 8 <= source.length) {
        const chunkStart = offset;
        const chunkType = readFourCC(source, offset);
        const chunkSize =
            source[offset + 4] |
            (source[offset + 5] << 8) |
            (source[offset + 6] << 16) |
            (source[offset + 7] << 24);

        const payloadStart = offset + 8;
        const paddedPayloadSize =
            chunkSize + (chunkSize % 2);
        const chunkEnd = payloadStart + paddedPayloadSize;

        if (chunkEnd > source.length) {
            throw new Error(
                `Invalid WebP: chunk ${chunkType} exceeds file length.`,
            );
        }

        if (strippedChunkTypes.has(chunkType)) {
            strippedChunkCount++;
            strippedByteCount += chunkEnd - chunkStart;
            offset = chunkEnd;
            continue;
        }

        const chunkCopy = source.slice(chunkStart, chunkEnd);

        if (chunkType === 'VP8X' && chunkSize >= 10) {
            // Clear metadata-related feature bits.
            // WebP VP8X feature flags commonly use:
            // ICCP = 0x20
            // EXIF = 0x08
            // XMP  = 0x04
            chunkCopy[8] &= ~(0x20 | 0x08 | 0x04);
        }

        outputChunks.push(chunkCopy);
        offset = chunkEnd;
    }

    const result = concatUint8Arrays(outputChunks);

    // RIFF chunk size = whole file size - 8
    writeUint32LE(result, 4, result.length - 8);

    return new Blob(
        [result.buffer.slice(
            result.byteOffset,
            result.byteOffset + result.byteLength,
        ) as ArrayBuffer],
        {
            type: 'image/webp',
        },
    );
}