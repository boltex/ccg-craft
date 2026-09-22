// Sheet strip simulator controller for managing and simulating pack collation. 
// Should be serialazable to save in local storage and be restored later.
// One per rarity-sheet of each set of cards.

export class PackSimController {

    // strip heights sequence, wraps around.
    private _stripHeights: number[];
    private _currentStripIndex: number;

    // Sheets are 11 by 11. Total of 121 cards per sheet.
    // strip width is implied of 11 cards.
    private _sheetWidth: number = 11; // Width of the sheet in cards. Implied to be 11.
    private _sheetHeight: number = 11; // Height of the sheet in cards. Implied to be 11.

    private _stripy: number; // Current y position of the top of the current strip being processed.

    private _currentX: number; // Current x position within the strip. This is relative to the sheet, not the strip itself.
    private _currentY: number; // Current y position within the strip. This is relative to the sheet, not the strip itself.

    constructor(stripSequence: number[], stripIndex: number, stripy?: number, currentX?: number, currentY?: number) {

        this._stripHeights = stripSequence;
        this._currentStripIndex = stripIndex;

        if (!Number.isInteger(this._currentStripIndex) || this._currentStripIndex < 0 || this._currentStripIndex >= (stripSequence?.length ?? this._stripHeights.length)) {
            throw new Error("stripIndex is out of range.");
        }

        const stripHeight = this._stripHeights[this._currentStripIndex];

        // The y is calculated modulo 11 so it wraps around the sheet height if it exceeds the sheet height.
        this._stripy = stripy ?? (this._sheetHeight - stripHeight); // Given, or place the strip at the bottom of the sheet.
        this._validateSheetCoordinate(this._stripy, "stripy");

        // Current x is anywhere within the sheet width.
        this._currentX = currentX ?? this._sheetWidth - 1; // given or default to the rightmost column
        this._validateSheetCoordinate(this._currentX, "currentX");
        // Current y is anywhere within the current strip being processed.
        this._currentY = currentY ?? this._normalizeSheetCoordinate(this._stripy + stripHeight - 1); // default to the bottom of the current strip
        this._validateSheetCoordinate(this._currentY, "currentY");

        // Maybe currentY was given as an argument and is not in the range of the current strip. (given we also wrap around vertically) error out if so.
        if (this._verticalDistanceFromStripTop() >= stripHeight) {
            throw new Error("currentY is out of the range of the current strip.");
        }

        console.log(`Initialized PackSimController with stripHeight=${stripHeight}, stripy=${this._stripy}, currentX=${this._currentX}, currentY=${this._currentY}`);
    }

    public setState(stripIndex?: number, stripy?: number, currentX?: number, currentY?: number, stripSequence?: number[],) {
        if (stripSequence) {
            this._stripHeights = stripSequence;
        }
        if (stripIndex !== undefined) {
            this._currentStripIndex = stripIndex;
        }
        if (stripy !== undefined) {
            this._stripy = stripy;
        }
        if (currentX !== undefined) {
            this._currentX = currentX;
        }
        if (currentY !== undefined) {
            this._currentY = currentY;
        }

        this._validateSheetCoordinate(this._stripy, "stripy");
        this._validateSheetCoordinate(this._currentX, "currentX");
        this._validateSheetCoordinate(this._currentY, "currentY");

        if (!Number.isInteger(this._currentStripIndex) || this._currentStripIndex < 0 || this._currentStripIndex >= (stripSequence?.length ?? this._stripHeights.length)) {
            throw new Error("stripIndex is out of range.");
        }

        const stripHeight = this._stripHeights[this._currentStripIndex];
        if (this._verticalDistanceFromStripTop() >= stripHeight) {
            throw new Error("currentY is out of the range of the current strip.");
        }

        console.log(`Set PackSimController with stripHeight=${stripHeight}, stripy=${this._stripy}, currentX=${this._currentX}, currentY=${this._currentY}`);

    }

    public serialize(): { stripIndex: number, stripy: number, currentX: number, currentY: number, stripSequence: number[], } {
        // could be used to store in localStorage and be recreated with the constructor later.
        return {
            stripIndex: this._currentStripIndex,
            stripy: this._stripy,
            currentX: this._currentX,
            currentY: this._currentY,
            stripSequence: this._stripHeights,
        };
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
        const stripHeight = this._stripHeights[this._currentStripIndex];

        if (this._verticalDistanceFromStripTop() > 0) {
            // Move up within the strip
            this._currentY = this._normalizeSheetCoordinate(this._currentY - 1);
        } else {
            if (this._currentX > 0) {
                // Move x left to the previous column and change y down to the bottom of the current strip
                this._currentX--;
                this._currentY = this._normalizeSheetCoordinate(this._stripy + stripHeight - 1);
            } else {
                // Move x to the complete right, and start a new strip of height chosen from the sequence of strip heights.
                this._currentX = this._sheetWidth - 1;
                this._currentStripIndex = (this._currentStripIndex + 1) % this._stripHeights.length; // Increment to the next strip index
                const newStripHeight = this._stripHeights[this._currentStripIndex];
                this._stripy = this._normalizeSheetCoordinate(this._stripy - newStripHeight);
                this._currentY = this._normalizeSheetCoordinate(this._stripy + newStripHeight - 1);
            }
        }
        return { x: this._currentX, y: this._currentY };
    }

    private _normalizeSheetCoordinate(coordinate: number): number {
        return ((coordinate % this._sheetHeight) + this._sheetHeight) % this._sheetHeight;
    }

    private _validateSheetCoordinate(coordinate: number, name: string): void {
        if (!Number.isInteger(coordinate) || coordinate < 0 || coordinate >= this._sheetHeight) {
            throw new Error(`${name} is out of range.`);
        }
    }

    private _verticalDistanceFromStripTop(): number {
        return this._normalizeSheetCoordinate(this._currentY - this._stripy);
    }
};

// Seven possible packs. Only Limited and Legends have 'rare' cards.
export const packData: {
    key: string;
    label: string;
    deckEntry: string;
    image: string;
    stripSequence: number[];
    generation: {
        packSimController: PackSimController | undefined;
        sheet: string;
        count: number;
    }[];
}[] = [
        {
            key: "starterLimited",
            label: "Starter Pack",
            deckEntry: "Starter Limited",
            image: "starter-limited.webp",
            stripSequence: [2, 3, 4, 4, 3, 5],
            generation: [
                {
                    packSimController: undefined,
                    sheet: "limitedUncommon",
                    count: 13
                },
                {
                    packSimController: undefined,
                    sheet: "limitedRare",
                    count: 2
                },
                {
                    packSimController: undefined,
                    sheet: "limitedCommon",
                    count: 45
                },
            ]
        },
        {
            key: "boosterLimited",
            label: "Booster Pack",
            deckEntry: "Booster Limited",
            image: "booster-limited.webp",
            stripSequence: [2, 3, 4, 4, 3, 5],
            generation: [
                {
                    packSimController: undefined,
                    sheet: "limitedCommon",
                    count: 11
                },
                {
                    packSimController: undefined,
                    sheet: "limitedUncommon",
                    count: 3
                },
                {
                    packSimController: undefined,
                    sheet: "limitedRare",
                    count: 1
                },
            ]
        },
        {
            key: "boosterArabianNights",
            label: "Arabian Nights",
            deckEntry: "Booster Arabian Nights",
            image: "booster-arabian-nights.webp",
            stripSequence: [2, 3, 4, 4, 3, 5], // Sets other than 'Limited' may have different strip sequences.
            generation: [
                {
                    packSimController: undefined,
                    sheet: "arnUncommon",
                    count: 2
                },
                {
                    packSimController: undefined,
                    sheet: "arnCommon",
                    count: 6
                },
            ]
        },
        {
            key: "boosterAntiquities",
            label: "Antiquities",
            deckEntry: "Booster Antiquities",
            image: "booster-antiquities.webp",
            stripSequence: [2, 3, 4, 4, 3, 5], // Sets other than 'Limited' may have different strip sequences.
            generation: [
                {
                    packSimController: undefined,
                    sheet: "atqUncommon",
                    count: 2
                },
                {
                    packSimController: undefined,
                    sheet: "atqCommon",
                    count: 6
                },
            ]
        },
        {
            key: "boosterLegends",
            label: "Legends",
            deckEntry: "Booster Legends",
            image: "booster-legends.webp",
            stripSequence: [2, 3, 4, 4, 3, 5], // Sets other than 'Limited' may have different strip sequences.
            generation: [
                {
                    packSimController: undefined,
                    sheet: "lgnUncommon",
                    count: 3
                },
                {
                    packSimController: undefined,
                    sheet: "lgnRare",
                    count: 1
                },
                {
                    packSimController: undefined,
                    sheet: "lgnCommon",
                    count: 11
                },
            ]
        },
        {
            key: "boosterTheDark",
            label: "The Dark",
            deckEntry: "Booster The Dark",
            image: "booster-the-dark.webp",
            stripSequence: [2, 3, 4, 4, 3, 5], // Sets other than 'Limited' may have different strip sequences.
            generation: [
                {
                    packSimController: undefined,
                    sheet: "drkUncommon",
                    count: 2
                },
                {
                    packSimController: undefined,
                    sheet: "drkCommon",
                    count: 6
                },
            ]
        },
        {
            key: "boosterFallenEmpires",
            label: "Fallen Empires",
            deckEntry: "Booster Fallen Empires",
            image: "booster-fallen-empires.webp",
            stripSequence: [2, 3, 4, 4, 3, 5], // Sets other than 'Limited' may have different strip sequences.
            generation: [
                {
                    packSimController: undefined,
                    sheet: "femUncommon",
                    count: 2
                },
                {
                    packSimController: undefined,
                    sheet: "femCommon",
                    count: 6
                },
            ]
        }
    ];