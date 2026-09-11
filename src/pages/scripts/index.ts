const previewUrls = new WeakMap<HTMLInputElement, string>();

const imageInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
        "input[type=file][data-image-preview]",
    ),
);

for (const input of imageInputs) {
    input.addEventListener("input", () => updateImagePreview(input));
    input.addEventListener("change", () => updateImagePreview(input));
}

// Some mobile camera pickers restore the page before dispatching `change`.
window.addEventListener("focus", () => {
    window.setTimeout(refreshImagePreviews, 300);
});
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.setTimeout(refreshImagePreviews, 300);
});

const inventorySection =
    document.querySelector<HTMLElement>("#inventory-section");

if (inventorySection) {
    setupInventoryEditor(inventorySection);
}

function setupInventoryEditor(section: HTMLElement) {
    const editButton =
        section.querySelector<HTMLButtonElement>("#inventory-edit");
    const saveButton =
        section.querySelector<HTMLButtonElement>("#inventory-save");
    const discardButton =
        section.querySelector<HTMLButtonElement>("#inventory-discard");
    if (!editButton || !saveButton || !discardButton) return;
    const edit = editButton;
    const save = saveButton;
    const discard = discardButton;

    const updateForms = Array.from(
        section.querySelectorAll<HTMLFormElement>(
            "form[data-inventory-update-form]",
        ),
    );
    const dirtyForms = new Set<HTMLFormElement>();

    section.addEventListener("input", markChangedForm);
    section.addEventListener("change", markChangedForm);
    edit.addEventListener("click", () => setEditMode(true));
    discard.addEventListener("click", discardChanges);
    save.addEventListener("click", saveChanges);

    function markChangedForm(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.form) return;
        if (!target.form.matches("[data-inventory-update-form]")) return;
        dirtyForms.add(target.form);
    }

    function setEditMode(enabled: boolean) {
        for (const input of section.querySelectorAll<HTMLInputElement>(
            "[data-inventory-field]",
        )) {
            input.readOnly = !enabled;
        }
        for (const input of section.querySelectorAll<HTMLInputElement>(
            "input[type=file][data-image-preview]",
        )) {
            input.disabled = !enabled;
        }
        for (const element of section.querySelectorAll<HTMLElement>(
            "[data-inventory-edit-only]",
        )) {
            element.hidden = !enabled;
        }

        edit.hidden = enabled;
        save.hidden = !enabled;
        discard.hidden = !enabled;
    }

    function discardChanges() {
        for (const form of updateForms) form.reset();
        dirtyForms.clear();
        for (const input of section.querySelectorAll<HTMLInputElement>(
            "input[type=file][data-image-preview]",
        )) {
            updateImagePreview(input);
        }
        setEditMode(false);
    }

    async function saveChanges() {
        if (dirtyForms.size === 0) {
            setEditMode(false);
            return;
        }
        for (const form of dirtyForms) {
            if (!form.reportValidity()) return;
        }

        save.disabled = true;
        discard.disabled = true;
        setInventoryError("");

        try {
            for (const form of dirtyForms) {
                const response = await fetch(form.action, {
                    method: form.method,
                    body: new FormData(form),
                    credentials: "same-origin",
                    headers: { "HX-Request": "true" },
                });
                if (!response.ok) {
                    throw new Error(
                        (await response.text()) ||
                            "Could not save inventory changes.",
                    );
                }
            }
            window.location.reload();
        } catch (error) {
            setInventoryError(
                error instanceof Error
                    ? error.message
                    : "Could not save inventory changes.",
            );
            save.disabled = false;
            discard.disabled = false;
        }
    }
}

function updateImagePreview(input: HTMLInputElement) {
    const previewId = input.dataset.imagePreview;
    if (!previewId) return;

    const preview = document.getElementById(previewId);
    if (!(preview instanceof HTMLImageElement)) return;

    const oldUrl = previewUrls.get(input);
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    const empty = input.dataset.imageEmpty
        ? document.getElementById(input.dataset.imageEmpty)
        : null;
    const filename = input.dataset.imageFilename
        ? document.getElementById(input.dataset.imageFilename)
        : null;

    if (filename) filename.textContent = file ? file.name : "";

    if (file) {
        const url = URL.createObjectURL(file);
        previewUrls.set(input, url);
        preview.src = url;
        preview.hidden = false;
        if (empty) empty.hidden = true;
        return;
    }

    previewUrls.delete(input);
    const originalSrc = preview.dataset.originalSrc;
    if (originalSrc) {
        preview.src = originalSrc;
        preview.hidden = false;
        if (empty) empty.hidden = true;
    } else {
        preview.removeAttribute("src");
        preview.hidden = true;
        if (empty) empty.hidden = false;
    }
}

function refreshImagePreviews() {
    for (const input of imageInputs) updateImagePreview(input);
}

function setInventoryError(message: string) {
    const error = document.querySelector<HTMLElement>("#inventory-error");
    if (error) error.textContent = message;
}
