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

// src/pages/scripts/cartStorage.ts
var cartStorageKey = "giftShop.cart.v1";
var orderHistoryStorageKey = "giftShop.orderHistory.v1";
var checkoutStorageKey = "giftShop.checkoutId.v1";
var cartLockName = "giftShop.cart.lock.v1";
var fallbackLockStorageKey = "giftShop.cartLock.v1";
var fallbackRequestStoragePrefix = "giftShop.cartLockRequest.v1.";
var fallbackLeaseMilliseconds = 5000;
var browserCartLock = {
  run(operation) {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request(cartLockName, operation);
    }
    return withFallbackCartLock(operation);
  }
};
function readCart(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(cartStorageKey) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const cart = {};
    for (const [id, quantity] of Object.entries(parsed)) {
      if (/^\d+$/.test(id) && Number(id) > 0 && Number.isSafeInteger(quantity) && Number(quantity) > 0) {
        cart[id] = Number(quantity);
      }
    }
    return cart;
  } catch {
    return {};
  }
}
function setCartQuantity(inventoryId, quantity, storage = localStorage, lock = browserCartLock) {
  return lock.run(() => {
    const cart = readCart(storage);
    if (Number.isSafeInteger(quantity) && quantity > 0) {
      cart[String(inventoryId)] = quantity;
    } else {
      delete cart[String(inventoryId)];
    }
    writeCartWithoutLock(cart, storage);
    return cart;
  });
}
function addToCart(inventoryId, quantity, maximum, storage = localStorage, lock = browserCartLock) {
  return lock.run(() => {
    const cart = readCart(storage);
    cart[String(inventoryId)] = Math.min(maximum, (cart[String(inventoryId)] ?? 0) + quantity);
    writeCartWithoutLock(cart, storage);
    return cart;
  });
}
function beginCheckout(renderedRevision, storage = localStorage, lock = browserCartLock) {
  return lock.run(() => {
    const cart = readCart(storage);
    if (cartRevision(cart) !== renderedRevision) {
      return { status: "cart-changed" };
    }
    const existing = readCheckoutSubmission(storage);
    if (existing?.revision === renderedRevision) {
      return {
        status: "success",
        id: existing.id,
        revision: renderedRevision,
        cart
      };
    }
    const id = crypto.randomUUID();
    storage.setItem(checkoutStorageKey, JSON.stringify({ id, revision: renderedRevision }));
    return {
      status: "success",
      id,
      revision: renderedRevision,
      cart
    };
  });
}
function clearCartAfterSubmit(submittedRevision, submissionId, storage = localStorage, lock = browserCartLock) {
  return lock.run(() => {
    const checkout = readCheckoutSubmission(storage);
    if (cartRevision(readCart(storage)) !== submittedRevision || checkout?.revision !== submittedRevision || checkout.id !== submissionId) {
      return false;
    }
    writeCartWithoutLock({}, storage);
    return true;
  });
}
function cartRevision(cart) {
  return JSON.stringify(Object.entries(cart).sort(([first], [second]) => Number(first) - Number(second)));
}
function cartUnitCount(cart) {
  return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
}
function readOrderHistory(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(orderHistoryStorageKey) ?? "[]");
    if (!Array.isArray(parsed))
      return [];
    return Array.from(new Set(parsed.filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 100);
  } catch {
    return [];
  }
}
function rememberOrder(orderId, storage = localStorage, lock = browserCartLock) {
  return lock.run(() => {
    const history = readOrderHistory(storage).filter((id) => id !== orderId);
    storage.setItem(orderHistoryStorageKey, JSON.stringify([orderId, ...history].slice(0, 100)));
  });
}
function readCheckoutSubmission(storage) {
  try {
    const value = JSON.parse(storage.getItem(checkoutStorageKey) ?? "null");
    if (!value || typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id) || typeof value.revision !== "string") {
      return null;
    }
    return { id: value.id, revision: value.revision };
  } catch {
    return null;
  }
}
function writeCartWithoutLock(cart, storage) {
  const clean = sanitizeCart(cart);
  if (Object.keys(clean).length === 0)
    storage.removeItem(cartStorageKey);
  else
    storage.setItem(cartStorageKey, JSON.stringify(clean));
  storage.removeItem(checkoutStorageKey);
}
async function withFallbackCartLock(operation) {
  const owner = crypto.randomUUID();
  const requestKey = `${fallbackRequestStoragePrefix}${owner}`;
  const requestedAt = Date.now();
  let storageAvailable = true;
  try {
    localStorage.setItem(requestKey, JSON.stringify({
      owner,
      requestedAt,
      expiresAt: requestedAt + fallbackLeaseMilliseconds
    }));
    while (true) {
      const now = Date.now();
      localStorage.setItem(requestKey, JSON.stringify({
        owner,
        requestedAt,
        expiresAt: now + fallbackLeaseMilliseconds
      }));
      const lease = readFallbackLease();
      if (lease && lease.expiresAt > now && lease.owner !== owner) {
        await delay(20 + Math.random() * 30);
        continue;
      }
      const contenders = readFallbackRequests(now);
      if (contenders[0]?.owner !== owner) {
        await delay(20 + Math.random() * 30);
        continue;
      }
      localStorage.setItem(fallbackLockStorageKey, JSON.stringify({
        owner,
        expiresAt: now + fallbackLeaseMilliseconds
      }));
      await delay(20 + Math.random() * 20);
      if (readFallbackLease()?.owner === owner && readFallbackRequests(Date.now())[0]?.owner === owner) {
        break;
      }
      if (readFallbackLease()?.owner === owner) {
        localStorage.removeItem(fallbackLockStorageKey);
      }
    }
  } catch {
    storageAvailable = false;
  }
  try {
    return operation();
  } finally {
    if (storageAvailable) {
      try {
        if (readFallbackLease()?.owner === owner) {
          localStorage.removeItem(fallbackLockStorageKey);
        }
        localStorage.removeItem(requestKey);
      } catch {}
    }
  }
}
function readFallbackRequests(now) {
  const requests = [];
  for (let index = 0;index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(fallbackRequestStoragePrefix))
      continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      if (!value || typeof value.owner !== "string" || typeof value.requestedAt !== "number" || typeof value.expiresAt !== "number") {
        localStorage.removeItem(key);
        index--;
      } else if (value.expiresAt <= now) {
        localStorage.removeItem(key);
        index--;
      } else {
        requests.push({
          key,
          owner: value.owner,
          requestedAt: value.requestedAt
        });
      }
    } catch {
      localStorage.removeItem(key);
      index--;
    }
  }
  return requests.sort((first, second) => first.requestedAt - second.requestedAt || first.owner.localeCompare(second.owner));
}
function readFallbackLease() {
  try {
    const parsed = JSON.parse(localStorage.getItem(fallbackLockStorageKey) ?? "null");
    if (!parsed || typeof parsed !== "object")
      return null;
    const lease = parsed;
    if (typeof lease.owner !== "string" || typeof lease.expiresAt !== "number") {
      return null;
    }
    return { owner: lease.owner, expiresAt: lease.expiresAt };
  } catch {
    return null;
  }
}
function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
function sanitizeCart(cart) {
  const clean = {};
  for (const [id, quantity] of Object.entries(cart)) {
    if (/^\d+$/.test(id) && Number(id) > 0 && Number.isSafeInteger(quantity) && quantity > 0) {
      clean[id] = quantity;
    }
  }
  return clean;
}

// src/pages/scripts/cart.ts
updateCartLinks();
setupCatalogue();
window.addEventListener("storage", (event) => {
  if (event.key === cartStorageKey)
    updateCartLinks();
});
document.addEventListener("cartchange", updateCartLinks);
function updateCartLinks() {
  const count = cartUnitCount(readCart());
  for (const link of document.querySelectorAll("[data-js-cartLink]")) {
    link.textContent = count > 0 ? `Cart (${count})` : "Cart";
  }
}
function setupCatalogue() {
  for (const item of document.querySelectorAll("[data-js-catalogueItem]")) {
    const input = item.querySelector("[data-js-quantityInput]");
    const decrease = item.querySelector("[data-js-quantityDecrease]");
    const increase = item.querySelector("[data-js-quantityIncrease]");
    const add = item.querySelector("[data-js-addToCart]");
    const message = item.querySelector("[data-js-addedMessage]");
    const inventoryId = Number(item.dataset.inventoryId);
    const maximum = Number(item.dataset.maxQuantity);
    if (!input || !decrease || !increase || !add || !message)
      continue;
    decrease.addEventListener("click", () => {
      input.value = String(validQuantity(input, maximum) - 1);
      normalizeInput(input, maximum);
    });
    increase.addEventListener("click", () => {
      input.value = String(validQuantity(input, maximum) + 1);
      normalizeInput(input, maximum);
    });
    input.addEventListener("change", () => normalizeInput(input, maximum));
    add.addEventListener("click", async () => {
      const quantity = validQuantity(input, maximum);
      add.disabled = true;
      try {
        await addToCart(inventoryId, quantity, maximum);
        updateCartLinks();
        message.textContent = "Added";
        window.setTimeout(() => {
          message.textContent = "";
        }, 1500);
      } finally {
        add.disabled = false;
      }
    });
  }
}
function validQuantity(input, maximum) {
  const quantity = Number(input.value);
  if (!Number.isSafeInteger(quantity))
    return 1;
  return Math.max(1, Math.min(maximum, quantity));
}
function normalizeInput(input, maximum) {
  input.value = String(validQuantity(input, maximum));
}

// src/pages/scripts/cartPageState.ts
class CartPageState {
  generation = 0;
  renderedRevision = null;
  beginRender(cart) {
    this.renderedRevision = null;
    return {
      generation: ++this.generation,
      revision: cartRevision(cart)
    };
  }
  acceptRender(token, currentCart) {
    if (!this.isCurrentRender(token, currentCart))
      return false;
    this.renderedRevision = token.revision;
    return true;
  }
  isCurrentRender(token, currentCart) {
    return token.generation === this.generation && token.revision === cartRevision(currentCart);
  }
  acceptRenderedRevision(revision, currentCart) {
    if (revision !== cartRevision(currentCart))
      return false;
    this.renderedRevision = revision;
    return true;
  }
  canSubmit(cart) {
    return this.renderedRevision === cartRevision(cart);
  }
}

// src/pages/scripts/partialRefreshState.ts
function whenHtmxInitialized(element, operation) {
  if (element.hasAttribute("data-htmx-powered")) {
    operation();
    return;
  }
  const handleInit = (event) => {
    if (event.target !== element)
      return;
    element.removeEventListener("htmx:after:init", handleInit);
    operation();
  };
  element.addEventListener("htmx:after:init", handleInit);
}

class PartialRefreshState {
  generation = 0;
  begin(revision) {
    return { generation: ++this.generation, revision };
  }
  isCurrent(token, currentRevision) {
    return token.generation === this.generation && token.revision === currentRevision;
  }
}
function htmxContext(event) {
  return event.detail?.ctx;
}
function refreshToken(event) {
  const detail = event?.detail;
  if (!detail || !Number.isSafeInteger(detail.generation) || typeof detail.revision !== "string") {
    return null;
  }
  return {
    generation: Number(detail.generation),
    revision: detail.revision
  };
}
function isSuccessfulHtmxResponse(context) {
  return (context?.response?.status ?? 500) < 400;
}

// src/pages/scripts/cartPage.ts
for (const page of document.querySelectorAll("[data-js-cartPage]")) {
  setupCartPage(page);
}
function setupCartPage(page) {
  const payloadCandidate = page.querySelector("[data-js-cartPayload]");
  const contentsCandidate = page.querySelector("[data-js-cartContents]");
  const errorCandidate = page.querySelector("[data-js-cartError]");
  if (!payloadCandidate || !contentsCandidate || !errorCandidate)
    return;
  const payload = payloadCandidate;
  const contents = contentsCandidate;
  const errorElement = errorCandidate;
  const state = new CartPageState;
  let customerName = "";
  whenHtmxInitialized(contents, refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === cartStorageKey)
      refresh();
  });
  contents.addEventListener("click", handleContentsClick);
  contents.addEventListener("change", handleQuantityChange);
  contents.addEventListener("htmx:before:swap", handleBeforeSwap);
  contents.addEventListener("htmx:after:swap", handleAfterSwap);
  contents.addEventListener("htmx:response:error", handleResponseError);
  page.addEventListener("submit", submitOrder);
  function refresh() {
    const nameInput = contents.querySelector('[data-js-checkoutForm] input[name="customerName"]');
    if (nameInput)
      customerName = nameInput.value;
    const cart = readCart();
    const token = state.beginRender(cart);
    payload.value = JSON.stringify(cart);
    errorElement.textContent = "";
    contents.dispatchEvent(new CustomEvent("cart-refresh", {
      bubbles: true,
      detail: token
    }));
  }
  function handleBeforeSwap(event) {
    const context = htmxContext(event);
    if (!isSuccessfulHtmxResponse(context)) {
      event.preventDefault();
      return;
    }
    const token = refreshToken(context?.sourceEvent);
    if (!token || !state.isCurrentRender(token, readCart())) {
      event.preventDefault();
    }
  }
  function handleAfterSwap() {
    const rendered = contents.querySelector("[data-js-cartRendered]");
    if (!rendered?.dataset.cartRevision || !state.acceptRenderedRevision(rendered.dataset.cartRevision, readCart())) {
      errorElement.textContent = "The cart changed. Review the latest quantities before submitting.";
      return;
    }
    const nameInput = contents.querySelector('[data-js-checkoutForm] input[name="customerName"]');
    if (nameInput)
      nameInput.value = customerName;
    errorElement.textContent = "";
  }
  function handleResponseError(event) {
    const token = refreshToken(htmxContext(event)?.sourceEvent);
    if (!token || !state.isCurrentRender(token, readCart()))
      return;
    contents.replaceChildren();
    errorElement.textContent = "Could not load the cart.";
  }
  function handleContentsClick(event) {
    const target = event.target;
    if (!(target instanceof Element))
      return;
    const item = target.closest("[data-js-cartItem]");
    if (!item)
      return;
    const inventoryId = Number(item.dataset.inventoryId);
    const input = item.querySelector("[data-js-cartQuantity]");
    if (!Number.isSafeInteger(inventoryId) || !input)
      return;
    if (target.closest("[data-js-cartRemove]")) {
      changeQuantity(inventoryId, 0);
    } else if (target.closest("[data-js-cartDecrease]")) {
      changeQuantity(inventoryId, Math.max(1, Number(input.value) - 1));
    } else if (target.closest("[data-js-cartIncrease]")) {
      changeQuantity(inventoryId, limitedQuantity(Number(input.value) + 1, item));
    }
  }
  function handleQuantityChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement))
      return;
    if (!input.matches("[data-js-cartQuantity]"))
      return;
    const item = input.closest("[data-js-cartItem]");
    const inventoryId = Number(item?.dataset.inventoryId);
    const quantity = Number(input.value);
    if (!item || !Number.isSafeInteger(inventoryId) || !Number.isSafeInteger(quantity) || quantity < 1) {
      refresh();
      return;
    }
    changeQuantity(inventoryId, limitedQuantity(quantity, item));
  }
  function limitedQuantity(quantity, item) {
    const maximum = Number(item.dataset.maxQuantity);
    return Number.isSafeInteger(maximum) && maximum > 0 ? Math.min(maximum, quantity) : quantity;
  }
  async function changeQuantity(inventoryId, quantity) {
    await setCartQuantity(inventoryId, quantity);
    document.dispatchEvent(new CustomEvent("cartchange"));
    refresh();
  }
  async function submitOrder(event) {
    const checkoutForm = event.target;
    if (!(checkoutForm instanceof HTMLFormElement) || !checkoutForm.matches("[data-js-checkoutForm]")) {
      return;
    }
    event.preventDefault();
    if (!checkoutForm.reportValidity())
      return;
    const renderedCart = readCart();
    if (!state.canSubmit(renderedCart)) {
      errorElement.textContent = "The cart changed. Review the latest quantities before submitting.";
      refresh();
      return;
    }
    const submitButton = checkoutForm.querySelector('button[type="submit"]');
    if (submitButton?.disabled)
      return;
    if (submitButton)
      submitButton.disabled = true;
    try {
      const checkout = await beginCheckout(cartRevision(renderedCart));
      if (checkout.status === "cart-changed") {
        errorElement.textContent = "The cart changed. Review the latest quantities before submitting.";
        refresh();
        return;
      }
      const items = Object.entries(checkout.cart).map(([inventoryId, quantity]) => ({
        inventoryId: Number(inventoryId),
        quantity
      }));
      if (items.length === 0 || !window.confirm("Submit this order?")) {
        return;
      }
      errorElement.textContent = "";
      const response = await fetch("/api/orders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: new FormData(checkoutForm).get("customerName"),
          submissionId: checkout.id,
          items
        })
      });
      const result = await response.json();
      if (!response.ok || !result.order) {
        throw new Error(result.error || "Could not submit the order.");
      }
      await rememberOrder(result.order.id);
      await clearCartAfterSubmit(checkout.revision, checkout.id);
      window.location.assign(`/orders/${result.order.id}`);
    } catch (error) {
      errorElement.textContent = errorMessage(error, "Could not submit the order.");
    } finally {
      if (submitButton)
        submitButton.disabled = false;
    }
  }
}
function errorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

// src/pages/scripts/ordersPage.ts
for (const page of document.querySelectorAll("[data-js-ordersPage]")) {
  setupOrdersPage(page);
}
function setupOrdersPage(page) {
  const payload = page.querySelector("[data-js-ordersHistoryPayload]");
  const list = page.querySelector("[data-js-ordersList]");
  const error = page.querySelector("[data-js-ordersError]");
  if (!payload || !list || !error)
    return;
  const state = new PartialRefreshState;
  const load = () => {
    const revision = JSON.stringify(readOrderHistory());
    const token = state.begin(revision);
    payload.value = revision;
    error.textContent = "";
    list.dispatchEvent(new CustomEvent("order-history-refresh", {
      bubbles: true,
      detail: token
    }));
  };
  whenHtmxInitialized(list, load);
  window.addEventListener("storage", (event) => {
    if (event.key === orderHistoryStorageKey)
      load();
  });
  list.addEventListener("htmx:before:swap", (event) => {
    const context = htmxContext(event);
    const token = refreshToken(context?.sourceEvent);
    const currentRevision = JSON.stringify(readOrderHistory());
    if (!isSuccessfulHtmxResponse(context) || !token || !state.isCurrent(token, currentRevision)) {
      event.preventDefault();
    }
  });
  list.addEventListener("htmx:after:swap", (event) => {
    const token = refreshToken(htmxContext(event)?.sourceEvent);
    if (!token || !state.isCurrent(token, JSON.stringify(readOrderHistory()))) {
      return;
    }
    error.textContent = "";
  });
  list.addEventListener("htmx:response:error", (event) => {
    const token = refreshToken(htmxContext(event)?.sourceEvent);
    if (!token || !state.isCurrent(token, JSON.stringify(readOrderHistory()))) {
      return;
    }
    list.replaceChildren();
    error.textContent = "Could not load order history.";
  });
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
