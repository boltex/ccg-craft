// Builds one checkbox per edition, all checked by default, and keeps a live selection dict.

export function buildEditionCheckboxes(editions: string[], container: HTMLElement): Record<string, boolean> {
    const selection: Record<string, boolean> = {};

    container.replaceChildren();

    editions.forEach((code, index) => {
        selection[code] = true;

        let labelCode = code;

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = true;
        input.dataset.edition = code;
        input.addEventListener("change", () => {
            selection[code] = input.checked;
        });

        const badge = document.createElement("span");
        badge.className = "exp-front";
        // Mirrors the badge character logic used when rendering the edition badge on a card face.
        if (code === "UN") {
            labelCode = "Beta";
            // no text content in badge for Beta edition
        } else {
            // add text content for other editions
            labelCode = code.toLowerCase()
            labelCode = labelCode.charAt(0).toUpperCase() + labelCode.slice(1);
            badge.textContent = String.fromCharCode(index + 34);
        }

        const label = document.createElement("label");
        label.className = "edition-checkbox";

        // Special cases for code.

        label.append(input, document.createTextNode(labelCode), badge);

        container.append(label);
    });

    return selection;
}
