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

// src/utils.ts
function formatPrice(priceCentsX10) {
  const whole = Math.floor(priceCentsX10 / 100);
  const fraction = String(priceCentsX10 % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
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
  canSubmit(cart) {
    return this.renderedRevision === cartRevision(cart);
  }
}

// src/pages/scripts/cartPage.ts
for (const page of document.querySelectorAll("[data-js-cartPage]")) {
  setupCartPage(page);
}
function setupCartPage(page) {
  const loadingCandidate = page.querySelector("[data-js-cartLoading]");
  const itemsCandidate = page.querySelector("[data-js-cartItems]");
  const errorCandidate = page.querySelector("[data-js-cartError]");
  const formCandidate = page.querySelector("[data-js-checkoutForm]");
  if (!loadingCandidate || !itemsCandidate || !errorCandidate || !formCandidate) {
    return;
  }
  const loading = loadingCandidate;
  const itemsElement = itemsCandidate;
  const errorElement = errorCandidate;
  const checkoutForm = formCandidate;
  const state = new CartPageState;
  render();
  window.addEventListener("storage", (event) => {
    if (event.key === cartStorageKey)
      render();
  });
  checkoutForm.addEventListener("submit", submitOrder);
  async function render() {
    const cart = readCart();
    const renderToken = state.beginRender(cart);
    const ids = Object.keys(cart);
    itemsElement.replaceChildren();
    checkoutForm.hidden = ids.length === 0;
    if (ids.length === 0) {
      if (!state.acceptRender(renderToken, readCart()))
        return;
      errorElement.textContent = "";
      loading.textContent = "Your cart is empty.";
      return;
    }
    loading.textContent = "Loading cart…";
    try {
      const response = await fetch(`/api/inventory/cart?ids=${encodeURIComponent(ids.join(","))}`);
      if (!response.ok)
        throw new Error("Could not load the cart.");
      const inventory = await response.json();
      if (!state.acceptRender(renderToken, readCart()))
        return;
      const currentInventory = new Map(inventory.map((item) => [item.id, item]));
      errorElement.textContent = "";
      let total = 0;
      for (const id of ids) {
        const inventoryId = Number(id);
        const item = currentInventory.get(inventoryId);
        const quantity = cart[id];
        itemsElement.append(createCartItem(inventoryId, quantity, item));
        if (item)
          total += item.priceCentsX10 * quantity;
      }
      const totalElement = document.createElement("p");
      totalElement.className = "text-lg font-semibold text-right";
      totalElement.textContent = `Current marked total: ${formatPrice(total)}`;
      itemsElement.append(totalElement);
      loading.textContent = "";
    } catch (error) {
      if (!state.isCurrentRender(renderToken, readCart()))
        return;
      loading.textContent = "";
      errorElement.textContent = errorMessage(error, "Could not load the cart.");
    }
  }
  function createCartItem(inventoryId, quantity, item) {
    const article = document.createElement("article");
    article.className = "grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center";
    const description = document.createElement("div");
    const heading = document.createElement("h2");
    heading.className = "font-semibold";
    heading.textContent = item?.name ?? `Deleted inventory item #${inventoryId}`;
    const detail = document.createElement("p");
    detail.className = "text-sm text-gray-600";
    detail.textContent = item ? `${formatPrice(item.priceCentsX10)} each · ${item.quantity} currently available` : "This item was deleted, but can still be submitted for admin review.";
    description.append(heading, detail);
    const controls = document.createElement("div");
    controls.className = "flex flex-wrap items-center gap-2";
    const decrease = button("−", `Decrease ${heading.textContent} quantity`);
    const input = document.createElement("input");
    input.className = "w-16 rounded-md border border-gray-300 px-2 py-2 text-center";
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.value = String(quantity);
    input.setAttribute("aria-label", `${heading.textContent} quantity`);
    if (item)
      input.max = String(item.quantity);
    const increase = button("+", `Increase ${heading.textContent} quantity`);
    increase.disabled = item ? quantity >= item.quantity : false;
    decrease.disabled = quantity <= 1;
    const remove = button("Remove", `Remove ${heading.textContent}`);
    remove.className = "rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700";
    decrease.addEventListener("click", () => {
      changeQuantity(inventoryId, Math.max(1, Number(input.value) - 1));
    });
    increase.addEventListener("click", () => {
      const next = Number(input.value) + 1;
      changeQuantity(inventoryId, item ? Math.min(item.quantity, next) : next);
    });
    input.addEventListener("change", () => {
      const next = Number(input.value);
      if (!Number.isSafeInteger(next) || next < 1)
        input.value = String(quantity);
      else {
        changeQuantity(inventoryId, item ? Math.min(item.quantity, next) : next);
      }
    });
    remove.addEventListener("click", () => {
      changeQuantity(inventoryId, 0);
    });
    controls.append(decrease, input, increase, remove);
    article.append(description, controls);
    return article;
  }
  async function changeQuantity(inventoryId, quantity) {
    await setCartQuantity(inventoryId, quantity);
    document.dispatchEvent(new CustomEvent("cartchange"));
    await render();
  }
  async function submitOrder(event) {
    event.preventDefault();
    if (!checkoutForm.reportValidity())
      return;
    const renderedCart = readCart();
    if (!state.canSubmit(renderedCart)) {
      errorElement.textContent = "The cart changed. Review the latest quantities before submitting.";
      render();
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
        if (submitButton)
          submitButton.disabled = false;
        errorElement.textContent = "The cart changed. Review the latest quantities before submitting.";
        render();
        return;
      }
      const items = Object.entries(checkout.cart).map(([inventoryId, quantity]) => ({
        inventoryId: Number(inventoryId),
        quantity
      }));
      if (items.length === 0 || !window.confirm("Submit this order?")) {
        if (submitButton)
          submitButton.disabled = false;
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
      if (submitButton)
        submitButton.disabled = false;
    }
  }
}
function button(text, label) {
  const element = document.createElement("button");
  element.className = "rounded-md border border-gray-300 px-3 py-2 font-medium";
  element.type = "button";
  element.textContent = text;
  element.setAttribute("aria-label", label);
  return element;
}
function errorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

// src/pages/scripts/ordersPage.ts
for (const page of document.querySelectorAll("[data-js-ordersPage]")) {
  renderOrders(page);
}
async function renderOrders(page) {
  const loading = page.querySelector("[data-js-ordersLoading]");
  const error = page.querySelector("[data-js-ordersError]");
  const list = page.querySelector("[data-js-ordersList]");
  if (!loading || !error || !list)
    return;
  const ids = readOrderHistory();
  if (ids.length === 0) {
    loading.textContent = "No orders have been submitted from this browser.";
    return;
  }
  try {
    const response = await fetch(`/api/orders?ids=${encodeURIComponent(ids.join(","))}`);
    if (!response.ok)
      throw new Error("Could not load order history.");
    const orders = await response.json();
    loading.textContent = orders.length === 0 ? "No saved orders were found." : "";
    for (const order of orders)
      list.append(createOrderLink(order));
  } catch (caught) {
    loading.textContent = "";
    error.textContent = caught instanceof Error ? caught.message : "Could not load order history.";
  }
}
function createOrderLink(order) {
  const link = document.createElement("a");
  link.className = "grid gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400 sm:grid-cols-4";
  link.href = `/orders/${order.id}`;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = order.items.reduce((sum, item) => sum + (item.inventory?.priceCentsX10 ?? 0) * item.quantity, 0);
  for (const text of [
    new Date(order.createdAt).toLocaleString(),
    order.customerName,
    `${order.status[0]?.toUpperCase()}${order.status.slice(1)}`,
    `${units} units · ${formatPrice(total)} current total`
  ]) {
    const span = document.createElement("span");
    span.textContent = text;
    link.append(span);
  }
  return link;
}

// src/pages/scripts/nativeAlert.ts
for (const element of document.querySelectorAll("[data-js-nativeAlert]")) {
  window.alert(element.textContent?.trim() || "The request could not be completed.");
}
