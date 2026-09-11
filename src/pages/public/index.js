// src/pages/scripts/imagePreview.ts
var previewUrls = new WeakMap;
for (const eventName of ["input", "change"]) {
  document.addEventListener(eventName, (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.matches("[data-js-imagePreview]")) {
      updateImagePreview(input);
    }
  });
}
window.addEventListener("focus", () => {
  window.setTimeout(refreshImagePreviews, 300);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden)
    window.setTimeout(refreshImagePreviews, 300);
});
function updateImagePreview(input) {
  const previewId = input.dataset.imagePreview;
  if (!previewId)
    return;
  const preview = document.getElementById(previewId);
  if (!(preview instanceof HTMLImageElement))
    return;
  const oldUrl = previewUrls.get(input);
  if (oldUrl)
    URL.revokeObjectURL(oldUrl);
  const file = input.files && input.files.length > 0 ? input.files[0] : null;
  const empty = input.dataset.imageEmpty ? document.getElementById(input.dataset.imageEmpty) : null;
  const filename = input.dataset.imageFilename ? document.getElementById(input.dataset.imageFilename) : null;
  if (filename)
    filename.textContent = file ? file.name : "";
  if (file) {
    const url = URL.createObjectURL(file);
    previewUrls.set(input, url);
    preview.src = url;
    preview.hidden = false;
    if (empty)
      empty.hidden = true;
    return;
  }
  previewUrls.delete(input);
  const originalSrc = preview.dataset.originalSrc;
  if (originalSrc) {
    preview.src = originalSrc;
    preview.hidden = false;
    if (empty)
      empty.hidden = true;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
    if (empty)
      empty.hidden = false;
  }
}
function refreshImagePreviews() {
  for (const input of document.querySelectorAll("[data-js-imagePreview]")) {
    updateImagePreview(input);
  }
}

// src/pages/scripts/inventoryEditor.ts
for (const section of document.querySelectorAll("[data-js-inventoryEditor]")) {
  setupInventoryEditor(section);
}
function setupInventoryEditor(section) {
  const formCandidate = section.querySelector("[data-js-inventoryBulkForm]");
  const editCandidate = section.querySelector("[data-js-inventoryEdit]");
  const saveCandidate = section.querySelector("[data-js-inventorySave]");
  const discardCandidate = section.querySelector("[data-js-inventoryDiscard]");
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
    const error = errorSelector ? document.querySelector(errorSelector) : null;
    if (error)
      error.textContent = "";
    setEditMode(false);
  });
  function setEditMode(enabled) {
    for (const input of section.querySelectorAll("[data-js-inventoryField]")) {
      input.readOnly = !enabled;
    }
    for (const input of section.querySelectorAll("[data-js-imagePreview], [data-js-inventoryBoolean]")) {
      input.disabled = !enabled;
    }
    for (const element of section.querySelectorAll("[data-js-inventoryEditOnly]")) {
      element.hidden = !enabled;
    }
    edit.hidden = enabled;
    save.hidden = !enabled;
    discard.hidden = !enabled;
  }
  function discardChanges() {
    form.reset();
    for (const input of section.querySelectorAll("[data-js-imagePreview]")) {
      updateImagePreview(input);
    }
    setEditMode(false);
  }
}

// src/pages/scripts/orderEditor.ts
for (const section of document.querySelectorAll("[data-js-orderEditor]")) {
  setupOrderEditor(section);
}
function setupOrderEditor(section) {
  const formCandidate = section.querySelector("[data-js-orderEditForm]");
  const editCandidate = section.querySelector("[data-js-orderEdit]");
  const saveCandidate = section.querySelector("[data-js-orderSave]");
  const discardCandidate = section.querySelector("[data-js-orderDiscard]");
  if (!formCandidate || !editCandidate || !saveCandidate || !discardCandidate)
    return;
  const form = formCandidate;
  const edit = editCandidate;
  const save = saveCandidate;
  const discard = discardCandidate;
  edit.addEventListener("click", () => setEditMode(true));
  discard.addEventListener("click", () => {
    form.reset();
    setEditMode(false);
  });
  function setEditMode(enabled) {
    for (const field of section.querySelectorAll("[data-js-orderField]")) {
      field.disabled = !enabled;
    }
    for (const element of section.querySelectorAll("[data-js-orderEditOnly]")) {
      element.hidden = !enabled;
    }
    for (const element of section.querySelectorAll("[data-js-orderReadOnly]")) {
      element.hidden = enabled;
    }
    edit.hidden = enabled;
    save.hidden = !enabled;
    discard.hidden = !enabled;
  }
}

// src/pages/scripts/htmxErrors.ts
document.addEventListener("htmx:before:swap", (event) => {
  const context = htmxContext(event);
  if ((context?.response?.status ?? 0) < 500)
    return;
  event.preventDefault();
  showUnexpectedError(event, context);
});
document.addEventListener("htmx:error", (event) => {
  const context = htmxContext(event);
  if (context?.response)
    return;
  showUnexpectedError(event, context);
});
function showUnexpectedError(event, context) {
  const source = context?.sourceElement ?? (event.target instanceof Element ? event.target : null);
  const owner = source?.closest("[data-htmx-error]");
  const selector = owner?.dataset.htmxError;
  if (!selector)
    return;
  const error = document.querySelector(selector);
  if (error)
    error.textContent = "Could not complete the request. Try again.";
}
function htmxContext(event) {
  return event.detail?.ctx;
}
