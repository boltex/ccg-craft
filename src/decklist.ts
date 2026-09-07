export type DecklistEntry = {
    quantity: number;
    cardName: string;
};

// Normalizes raw decklist text (accents, quotes, "3x" quantity prefixes) into card-name/quantity pairs.
export function parseDecklistText(rawText: string): DecklistEntry[] {
    const cleanedLines = rawText
        .split(/\r?\n/)
        // also remove any quotes
        .map(line => line.replace(/"/g, ""))
        .map(line => line.trim().replace(/^[\s,]+|[\s,]+$/g, ""))
        // also replace accented letters with their non-accented counterparts
        .map(line => line.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
        // also lowercase the line for consistency
        .map(line => line.toLowerCase())
        .filter(line => line.length > 0);

    return cleanedLines.map(line => {
        const match = line.match(/^(\d+)x\s*(.*)$/i);
        if (match) {
            return { quantity: parseInt(match[1], 10), cardName: match[2] };
        }
        return { quantity: 1, cardName: line };
    });
}

export function downloadDecklist(text: string): void {
    const exportBlob = new Blob([text], { type: "text/plain" });
    const downloadUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `ccg-craft-decklist-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
}
