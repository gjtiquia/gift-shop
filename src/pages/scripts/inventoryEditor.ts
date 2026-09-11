import { updateImagePreview } from "./imagePreview";

for (const section of document.querySelectorAll<HTMLElement>(
    "[data-js-inventoryEditor]",
)) {
    setupInventoryEditor(section);
}

function setupInventoryEditor(section: HTMLElement) {
    const formCandidate = section.querySelector<HTMLFormElement>(
        "[data-js-inventoryBulkForm]",
    );
    const editCandidate = section.querySelector<HTMLButtonElement>(
        "[data-js-inventoryEdit]",
    );
    const saveCandidate = section.querySelector<HTMLButtonElement>(
        "[data-js-inventorySave]",
    );
    const discardCandidate = section.querySelector<HTMLButtonElement>(
        "[data-js-inventoryDiscard]",
    );
    if (!formCandidate || !editCandidate || !saveCandidate || !discardCandidate)
        return;
    const form = formCandidate;
    const edit = editCandidate;
    const save = saveCandidate;
    const discard = discardCandidate;

    edit.addEventListener("click", () => setEditMode(true));
    discard.addEventListener("click", discardChanges);
    section.addEventListener("inventory-saved", () => {
        const errorSelector = form.dataset.htmxError;
        const error = errorSelector
            ? document.querySelector<HTMLElement>(errorSelector)
            : null;
        if (error) error.textContent = "";
        setEditMode(false);
    });

    function setEditMode(enabled: boolean) {
        for (const input of section.querySelectorAll<HTMLInputElement>(
            "[data-js-inventoryField]",
        )) {
            input.readOnly = !enabled;
        }
        for (const input of section.querySelectorAll<HTMLInputElement>(
            "[data-js-imagePreview], [data-js-inventoryBoolean]",
        )) {
            input.disabled = !enabled;
        }
        for (const element of section.querySelectorAll<HTMLElement>(
            "[data-js-inventoryEditOnly]",
        )) {
            element.hidden = !enabled;
        }

        edit.hidden = enabled;
        save.hidden = !enabled;
        discard.hidden = !enabled;
    }

    function discardChanges() {
        form.reset();
        for (const input of section.querySelectorAll<HTMLInputElement>(
            "[data-js-imagePreview]",
        )) {
            updateImagePreview(input);
        }
        setEditMode(false);
    }
}
