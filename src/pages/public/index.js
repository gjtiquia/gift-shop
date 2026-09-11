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
    queueMicrotask(() => setEditMode(false));
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
  if (error) {
    error.textContent = "Could not confirm the result. Refresh the page before trying again.";
  }
}
function htmxContext(event) {
  return event.detail?.ctx;
}

// src/pages/scripts/pendingStates.ts
var requestRegions = new WeakMap;
var activeRequests = new WeakMap;
document.addEventListener("htmx:before:request", (event) => {
  const context = htmxContext2(event);
  const source = context?.sourceElement;
  const region = source?.closest("[data-loading-region]");
  if (!context || !region)
    return;
  requestRegions.set(context, region);
  const count = (activeRequests.get(region) ?? 0) + 1;
  activeRequests.set(region, count);
  setRegionPending(region, true);
});
document.addEventListener("htmx:finally:request", (event) => {
  const context = htmxContext2(event);
  if (!context)
    return;
  const region = requestRegions.get(context);
  if (!region)
    return;
  requestRegions.delete(context);
  const count = Math.max(0, (activeRequests.get(region) ?? 1) - 1);
  if (count > 0) {
    activeRequests.set(region, count);
    return;
  }
  activeRequests.delete(region);
  setRegionPending(region, false);
});
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element))
    return;
  const link = target.closest("a[data-pending-navigation-disabled]");
  if (link)
    event.preventDefault();
});
document.addEventListener("submit", (event) => {
  if (event.defaultPrevented)
    return;
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-native-pending")) {
    return;
  }
  if (form.dataset.submitting === "true") {
    event.preventDefault();
    return;
  }
  form.dataset.submitting = "true";
  form.setAttribute("aria-busy", "true");
  const submitter = event.submitter;
  if (!(submitter instanceof HTMLButtonElement))
    return;
  submitter.disabled = true;
  const pendingLabel = submitter.dataset.pendingLabel;
  if (pendingLabel)
    submitter.textContent = pendingLabel;
});
function setRegionPending(region, pending) {
  region.setAttribute("aria-busy", String(pending));
  const selector = region.dataset.pendingNavigation;
  if (!selector)
    return;
  for (const link of document.querySelectorAll(selector)) {
    if (pending) {
      link.setAttribute("aria-disabled", "true");
      link.setAttribute("data-pending-navigation-disabled", "");
    } else {
      link.removeAttribute("aria-disabled");
      link.removeAttribute("data-pending-navigation-disabled");
    }
  }
}
function htmxContext2(event) {
  return event.detail?.ctx;
}
