const previewUrls = new WeakMap<HTMLInputElement, string>();
const imageInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-js-imagePreview]"),
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

export function updateImagePreview(input: HTMLInputElement) {
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
