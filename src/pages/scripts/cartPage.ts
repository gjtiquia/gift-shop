import { formatPrice } from "../../utils";
import {
    beginCheckout,
    cartRevision,
    cartStorageKey,
    clearCartAfterSubmit,
    readCart,
    rememberOrder,
    setCartQuantity,
} from "./cartStorage";
import { CartPageState } from "./cartPageState";

interface InventoryItem {
    id: number;
    name: string;
    priceCentsX10: number;
    quantity: number;
    imageId: number | null;
}

interface CreateOrderResponse {
    error?: string;
    order?: { id: string };
}

for (const page of document.querySelectorAll<HTMLElement>(
    "[data-js-cartPage]",
)) {
    setupCartPage(page);
}

function setupCartPage(page: HTMLElement) {
    const loadingCandidate = page.querySelector<HTMLElement>(
        "[data-js-cartLoading]",
    );
    const itemsCandidate = page.querySelector<HTMLElement>(
        "[data-js-cartItems]",
    );
    const errorCandidate = page.querySelector<HTMLElement>(
        "[data-js-cartError]",
    );
    const formCandidate = page.querySelector<HTMLFormElement>(
        "[data-js-checkoutForm]",
    );
    if (
        !loadingCandidate ||
        !itemsCandidate ||
        !errorCandidate ||
        !formCandidate
    ) {
        return;
    }
    const loading = loadingCandidate;
    const itemsElement = itemsCandidate;
    const errorElement = errorCandidate;
    const checkoutForm = formCandidate;
    const state = new CartPageState();

    void render();
    window.addEventListener("storage", (event) => {
        if (event.key === cartStorageKey) void render();
    });
    checkoutForm.addEventListener("submit", submitOrder);

    async function render() {
        const cart = readCart();
        const renderToken = state.beginRender(cart);
        const ids = Object.keys(cart);
        itemsElement.replaceChildren();
        checkoutForm.hidden = ids.length === 0;
        if (ids.length === 0) {
            if (!state.acceptRender(renderToken, readCart())) return;
            errorElement.textContent = "";
            loading.textContent = "Your cart is empty.";
            return;
        }
        loading.textContent = "Loading cart…";

        try {
            const response = await fetch(
                `/api/inventory/cart?ids=${encodeURIComponent(ids.join(","))}`,
            );
            if (!response.ok) throw new Error("Could not load the cart.");
            const inventory = (await response.json()) as InventoryItem[];
            if (!state.acceptRender(renderToken, readCart())) return;
            const currentInventory = new Map(
                inventory.map((item) => [item.id, item]),
            );
            errorElement.textContent = "";
            let total = 0;
            for (const id of ids) {
                const inventoryId = Number(id);
                const item = currentInventory.get(inventoryId);
                const quantity = cart[id];
                itemsElement.append(
                    createCartItem(inventoryId, quantity, item),
                );
                if (item) total += item.priceCentsX10 * quantity;
            }
            const totalElement = document.createElement("p");
            totalElement.className = "text-lg font-semibold text-right";
            totalElement.textContent = `Current marked total: ${formatPrice(total)}`;
            itemsElement.append(totalElement);
            loading.textContent = "";
        } catch (error) {
            if (!state.isCurrentRender(renderToken, readCart())) return;
            loading.textContent = "";
            errorElement.textContent = errorMessage(
                error,
                "Could not load the cart.",
            );
        }
    }

    function createCartItem(
        inventoryId: number,
        quantity: number,
        item: InventoryItem | undefined,
    ) {
        const article = document.createElement("article");
        article.className =
            "grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center";
        const description = document.createElement("div");
        const heading = document.createElement("h2");
        heading.className = "font-semibold";
        heading.textContent =
            item?.name ?? `Deleted inventory item #${inventoryId}`;
        const detail = document.createElement("p");
        detail.className = "text-sm text-gray-600";
        detail.textContent = item
            ? `${formatPrice(item.priceCentsX10)} each · ${item.quantity} currently available`
            : "This item was deleted, but can still be submitted for admin review.";
        description.append(heading, detail);

        const controls = document.createElement("div");
        controls.className = "flex flex-wrap items-center gap-2";
        const decrease = button(
            "−",
            `Decrease ${heading.textContent} quantity`,
        );
        const input = document.createElement("input");
        input.className =
            "w-16 rounded-md border border-gray-300 px-2 py-2 text-center";
        input.type = "number";
        input.min = "1";
        input.step = "1";
        input.value = String(quantity);
        input.setAttribute("aria-label", `${heading.textContent} quantity`);
        if (item) input.max = String(item.quantity);
        const increase = button(
            "+",
            `Increase ${heading.textContent} quantity`,
        );
        increase.disabled = item ? quantity >= item.quantity : false;
        decrease.disabled = quantity <= 1;
        const remove = button("Remove", `Remove ${heading.textContent}`);
        remove.className =
            "rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700";

        decrease.addEventListener("click", () => {
            void changeQuantity(
                inventoryId,
                Math.max(1, Number(input.value) - 1),
            );
        });
        increase.addEventListener("click", () => {
            const next = Number(input.value) + 1;
            void changeQuantity(
                inventoryId,
                item ? Math.min(item.quantity, next) : next,
            );
        });
        input.addEventListener("change", () => {
            const next = Number(input.value);
            if (!Number.isSafeInteger(next) || next < 1)
                input.value = String(quantity);
            else {
                void changeQuantity(
                    inventoryId,
                    item ? Math.min(item.quantity, next) : next,
                );
            }
        });
        remove.addEventListener("click", () => {
            void changeQuantity(inventoryId, 0);
        });
        controls.append(decrease, input, increase, remove);
        article.append(description, controls);
        return article;
    }

    async function changeQuantity(inventoryId: number, quantity: number) {
        await setCartQuantity(inventoryId, quantity);
        document.dispatchEvent(new CustomEvent("cartchange"));
        await render();
    }

    async function submitOrder(event: SubmitEvent) {
        event.preventDefault();
        if (!checkoutForm.reportValidity()) return;

        const renderedCart = readCart();
        if (!state.canSubmit(renderedCart)) {
            errorElement.textContent =
                "The cart changed. Review the latest quantities before submitting.";
            void render();
            return;
        }
        const submitButton = checkoutForm.querySelector<HTMLButtonElement>(
            'button[type="submit"]',
        );
        if (submitButton?.disabled) return;
        if (submitButton) submitButton.disabled = true;

        try {
            const checkout = await beginCheckout(cartRevision(renderedCart));
            if (checkout.status === "cart-changed") {
                if (submitButton) submitButton.disabled = false;
                errorElement.textContent =
                    "The cart changed. Review the latest quantities before submitting.";
                void render();
                return;
            }
            const items = Object.entries(checkout.cart).map(
                ([inventoryId, quantity]) => ({
                    inventoryId: Number(inventoryId),
                    quantity,
                }),
            );
            if (items.length === 0 || !window.confirm("Submit this order?")) {
                if (submitButton) submitButton.disabled = false;
                return;
            }
            errorElement.textContent = "";

            const response = await fetch("/api/orders", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    customerName: new FormData(checkoutForm).get(
                        "customerName",
                    ),
                    submissionId: checkout.id,
                    items,
                }),
            });
            const result = (await response.json()) as CreateOrderResponse;
            if (!response.ok || !result.order) {
                throw new Error(result.error || "Could not submit the order.");
            }
            await rememberOrder(result.order.id);
            await clearCartAfterSubmit(checkout.revision, checkout.id);
            window.location.assign(`/orders/${result.order.id}`);
        } catch (error) {
            errorElement.textContent = errorMessage(
                error,
                "Could not submit the order.",
            );
            if (submitButton) submitButton.disabled = false;
        }
    }
}

function button(text: string, label: string) {
    const element = document.createElement("button");
    element.className =
        "rounded-md border border-gray-300 px-3 py-2 font-medium";
    element.type = "button";
    element.textContent = text;
    element.setAttribute("aria-label", label);
    return element;
}

function errorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}
