// src/pages/scripts/imagePreview.ts
var previewUrls = new WeakMap;
var imageInputs = Array.from(document.querySelectorAll("[data-js-imagePreview]"));
if (imageInputs.length > 0)
  setupImagePreviews();
function setupImagePreviews() {
  for (const input of imageInputs) {
    input.addEventListener("input", () => updateImagePreview(input));
    input.addEventListener("change", () => updateImagePreview(input));
  }
  window.addEventListener("focus", () => {
    window.setTimeout(refreshImagePreviews, 300);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden)
      window.setTimeout(refreshImagePreviews, 300);
  });
}
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
  for (const input of imageInputs)
    updateImagePreview(input);
}

// src/pages/scripts/inventoryEditor.ts
for (const section of document.querySelectorAll("[data-js-inventoryEditor]")) {
  setupInventoryEditor(section);
}
function setupInventoryEditor(section) {
  const editButton = section.querySelector("[data-js-inventoryEdit]");
  const saveButton = section.querySelector("[data-js-inventorySave]");
  const discardButton = section.querySelector("[data-js-inventoryDiscard]");
  if (!editButton || !saveButton || !discardButton)
    return;
  const edit = editButton;
  const save = saveButton;
  const discard = discardButton;
  const updateForms = Array.from(section.querySelectorAll("form[data-js-inventoryUpdateForm]"));
  const dirtyForms = new Set;
  section.addEventListener("input", markChangedForm);
  section.addEventListener("change", markChangedForm);
  edit.addEventListener("click", () => setEditMode(true));
  discard.addEventListener("click", discardChanges);
  save.addEventListener("click", saveChanges);
  function markChangedForm(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.form)
      return;
    if (!target.form.matches("[data-js-inventoryUpdateForm]"))
      return;
    dirtyForms.add(target.form);
  }
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
    for (const form of updateForms)
      form.reset();
    dirtyForms.clear();
    for (const input of section.querySelectorAll("[data-js-imagePreview]")) {
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
      if (!form.reportValidity())
        return;
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
          headers: { "HX-Request": "true" }
        });
        if (!response.ok) {
          throw new Error(await response.text() || "Could not save inventory changes.");
        }
      }
      window.location.reload();
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Could not save inventory changes.");
      save.disabled = false;
      discard.disabled = false;
    }
  }
}
function setInventoryError(message) {
  const error = document.querySelector("[data-js-inventoryError]");
  if (error)
    error.textContent = message;
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

// src/pages/scripts/nativeAlert.ts
for (const element of document.querySelectorAll("[data-js-nativeAlert]")) {
  window.alert(element.textContent?.trim() || "The request could not be completed.");
}
