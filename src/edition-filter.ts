// Builds one checkbox per edition, all checked by default, and keeps a live selection dict.

export function buildEditionCheckboxes(
    editions: Readonly<Record<string, {
        scry: string[];
        name: string;
    }>>,
    container: HTMLElement,
    onChange?: () => void
): Record<string, boolean> {
    const selection: Record<string, boolean> = {};
    const checkboxes: HTMLInputElement[] = [];

    container.replaceChildren();

    Object.entries(editions).forEach(([code, editionData], index) => {
        selection[code] = true;

        let labelCode = code;

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = true;
        input.dataset.edition = code;
        input.addEventListener("change", () => {
            selection[code] = input.checked;
            onChange?.();
        });
        checkboxes.push(input);

        const badge = document.createElement("span");
        badge.className = "exp-front";
        // Mirrors the badge character logic used when rendering the edition badge on a card face.
        if (code === "UN") {
            labelCode = "Limited";
            // no text content in badge for alpha/beta limited editions
        } else {
            // add text content for other editions
            labelCode = code.toLowerCase()
            labelCode = labelCode.charAt(0).toUpperCase() + labelCode.slice(1);
            badge.textContent = String.fromCharCode(index + 34);
        }

        const label = document.createElement("label");
        label.className = "edition-checkbox";

        // Add editionsData.name as a tooltip for the label.
        label.title = editionData.name;

        label.append(input, document.createTextNode(labelCode), badge);

        container.append(label);
    });


    // Create an element to contain the toggle buttons for better layout.
    const toggleContainer = document.createElement("div");
    // attach that container as sibling after container
    container.parentNode?.insertBefore(toggleContainer, container.nextSibling);

    toggleContainer.append(
        createSelectionToggleButton("None", false, checkboxes, selection, onChange),
        createSelectionToggleButton("All", true, checkboxes, selection, onChange),
        createSelectionToggleButton("Old School", [
            "BK",
            "UN",
            "AN",
            "AQ",
            "LE",
            "DK",
            "FE"
        ], checkboxes, selection, onChange)
    );

    return selection;
}

function createSelectionToggleButton(
    label: string,
    checkedValue: boolean | string[],
    checkboxes: HTMLInputElement[],
    selection: Record<string, boolean>,
    onChange?: () => void
): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "edition-checkboxes-toggle";
    button.textContent = label;

    if (typeof checkedValue === "boolean") {
        button.addEventListener("click", () => {
            for (const checkbox of checkboxes) {
                checkbox.checked = checkedValue;
                selection[checkbox.dataset.edition as string] = checkedValue;
            }
            onChange?.();
        });

    } else {
        // special case for string checkedValue
        button.addEventListener("click", () => {
            for (const checkbox of checkboxes) {
                checkbox.checked = checkedValue.includes(checkbox.dataset.edition as string);
                selection[checkbox.dataset.edition as string] = checkbox.checked;
            }
            onChange?.();
        });

    }


    return button;
}
