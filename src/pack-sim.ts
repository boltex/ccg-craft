// Sheet strip simulator controller for managing and simulating pack collation. 
// Should be serialazable to save in local storage and be restored later.
// One per rarity-sheet of each set of cards.

export class PackSimController {

    // strip heights sequence, wraps around.
    private _stripHeights: number[] = [2, 3, 4, 4, 3, 5];
    private _currentStripIndex: number = 0;

    // Sheets are 11 by 11. Total of 121 cards per sheet.
    // strip width is implied of 11 cards.
    private _sheetWidth: number = 11; // Width of the sheet in cards. Implied to be 11.
    private _sheetHeight: number = 11; // Height of the sheet in cards. Implied to be 11.

    private _stripy: number; // Current y position of the top of the current strip being processed.

    private _currentX: number; // Current x position within the strip. This is relative to the sheet, not the strip itself.
    private _currentY: number; // Current y position within the strip. This is relative to the sheet, not the strip itself.

    constructor(stripIndex?: number, stripy?: number, currentX?: number, currentY?: number) {
        this._currentStripIndex = stripIndex ?? Math.floor(Math.random() * this._stripHeights.length);
        const stripHeight = this._stripHeights[this._currentStripIndex];

        // The y is calculated modulo 11 so it wraps around the sheet height if it exceeds the sheet height.
        this._stripy = stripy ?? Math.floor(Math.random() * this._sheetHeight);

        // Current x is anywhere within the sheet width.
        this._currentX = currentX ?? Math.floor(Math.random() * this._sheetWidth);
        // Current y is anywhere within the current strip being processed.
        this._currentY = currentY ?? Math.floor(Math.random() * (stripHeight)) + this._stripy;

        // Maybe currentY was given as an argument and is not in the range of the current strip. (given we also wrap around vertically) error out if so.
        if ((this._currentY - this._stripy + this._sheetHeight) % this._sheetHeight >= stripHeight) {
            throw new Error("currentY is out of the range of the current strip.");
        }

        console.log(`Initialized PackSimController with stripHeight=${stripHeight}, stripy=${this._stripy}, currentX=${this._currentX}, currentY=${this._currentY}`);
    }

    public nextCardPosition(): { x: number, y: number } {
        // Give the next position calculated from the specific collation algorithm.

        // As per Tavis King, as seen in this video https://www.youtube.com/watch?v=vFGQ0qIGsWc
        /*  
            if not at the top of strip:
                move up within the strip
            else:
                if x > 0:
                    move x left to the previous column and change y down to the bottom of the current strip
                else:
                    move x to the complete right, and start a new strip of height chosen from the sequence of strip heights.
                    and place y at the bottom of the new strip which is at the top of the old strip. (wraps around vertically)

        */

        // For now just return the current position.

        return { x: this._currentX, y: this._currentY };
    }
};
