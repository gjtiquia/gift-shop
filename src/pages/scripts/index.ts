const previewUrls = new WeakMap<HTMLInputElement, string>();

type HtmxRequestContext = {
    response?: { status?: number };
    text?: string;
};

document.addEventListener("htmx:after:request", (event) => {
    const context = htmxRequestContext(event);
    const status = context?.response?.status;
    if (status === undefined || status < 200 || status >= 400) return;

    document.querySelector("#inventory-error")?.replaceChildren();

    const target = event.target;
    if (
        target instanceof HTMLFormElement &&
        target.matches("[data-reset-after-success]")
    ) {
        target.reset();
    }
});

document.addEventListener("htmx:response:error", (event) => {
    const error = document.querySelector("#inventory-error");
    const responseText = htmxRequestContext(event)?.text;
    if (error && responseText !== undefined) {
        error.replaceChildren(document.createTextNode(responseText));
    }
});

document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.matches("[data-image-input]")) {
        showSelectedImage(target);
        return;
    }

    if (target.matches("[data-remove-image-control]")) {
        toggleImageRemoval(target);
    }
});

document.addEventListener("reset", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    window.setTimeout(() => {
        for (const input of document.querySelectorAll<HTMLInputElement>(
            "[data-image-input]",
        )) {
            if (input.form === form) resetPreview(input);
        }
    });
});

document.addEventListener("htmx:before:cleanup", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const cleanupRoot = target.closest("tr") ?? target;
    if (
        cleanupRoot instanceof HTMLInputElement &&
        cleanupRoot.matches("[data-image-input]")
    ) {
        revokePreviewUrl(cleanupRoot);
    }
    for (const input of cleanupRoot.querySelectorAll<HTMLInputElement>(
        "[data-image-input]",
    )) {
        revokePreviewUrl(input);
    }
});

function htmxRequestContext(event: Event) {
    return (event as CustomEvent<{ ctx?: HtmxRequestContext }>).detail?.ctx;
}

function showSelectedImage(input: HTMLInputElement) {
    revokePreviewUrl(input);

    const preview = imageById(input.dataset.imagePreview);
    const currentImage = imageById(input.dataset.currentImage);
    const removeControl = input.dataset.removeImage
        ? document.getElementById(input.dataset.removeImage)
        : null;
    if (removeControl instanceof HTMLInputElement) {
        removeControl.checked = false;
    }

    const file = input.files?.[0];
    if (!file || !preview) {
        if (preview) {
            preview.removeAttribute("src");
            preview.classList.add("hidden");
        }
        currentImage?.classList.remove("hidden");
        return;
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrls.set(input, previewUrl);
    preview.src = previewUrl;
    preview.classList.remove("hidden");
    currentImage?.classList.add("hidden");
}

function toggleImageRemoval(removeControl: HTMLInputElement) {
    const currentImage = imageById(removeControl.dataset.currentImage);
    currentImage?.classList.toggle("hidden", removeControl.checked);

    if (!removeControl.checked) return;

    const row = removeControl.closest("tr");
    const imageInput =
        row?.querySelector<HTMLInputElement>("[data-image-input]");
    if (imageInput) {
        imageInput.value = "";
        resetPreview(imageInput, false);
        currentImage?.classList.add("hidden");
    }
}

function resetPreview(input: HTMLInputElement, showCurrent = true) {
    revokePreviewUrl(input);
    const preview = imageById(input.dataset.imagePreview);
    preview?.removeAttribute("src");
    preview?.classList.add("hidden");
    if (showCurrent) {
        imageById(input.dataset.currentImage)?.classList.remove("hidden");
    }
}

function revokePreviewUrl(input: HTMLInputElement) {
    const previousUrl = previewUrls.get(input);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    previewUrls.delete(input);
}

function imageById(id: string | undefined) {
    if (!id) return null;
    const element = document.getElementById(id);
    return element instanceof HTMLImageElement ? element : null;
}
