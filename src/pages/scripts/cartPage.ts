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
import {
    htmxContext,
    isSuccessfulHtmxResponse,
    refreshToken,
    whenHtmxInitialized,
} from "./partialRefreshState";

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
    const payloadCandidate = page.querySelector<HTMLInputElement>(
        "[data-js-cartPayload]",
    );
    const contentsCandidate = page.querySelector<HTMLElement>(
        "[data-js-cartContents]",
    );
    const errorCandidate = page.querySelector<HTMLElement>(
        "[data-js-cartError]",
    );
    if (!payloadCandidate || !contentsCandidate || !errorCandidate) return;
    const payload = payloadCandidate;
    const contents = contentsCandidate;
    const errorElement = errorCandidate;

    const state = new CartPageState();
    let customerName = "";

    whenHtmxInitialized(contents, refresh);

    window.addEventListener("storage", (event) => {
        if (event.key === cartStorageKey) refresh();
    });
    contents.addEventListener("click", handleContentsClick);
    contents.addEventListener("change", handleQuantityChange);
    contents.addEventListener("htmx:before:swap", handleBeforeSwap);
    contents.addEventListener("htmx:after:swap", handleAfterSwap);
    contents.addEventListener("htmx:response:error", handleResponseError);
    page.addEventListener("submit", submitOrder);

    function refresh() {
        const nameInput = contents.querySelector<HTMLInputElement>(
            '[data-js-checkoutForm] input[name="customerName"]',
        );
        if (nameInput) customerName = nameInput.value;

        const cart = readCart();
        const token = state.beginRender(cart);
        payload.value = JSON.stringify(cart);
        errorElement.textContent = "";
        contents.dispatchEvent(
            new CustomEvent("cart-refresh", {
                bubbles: true,
                detail: token,
            }),
        );
    }

    function handleBeforeSwap(event: Event) {
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
        const rendered = contents.querySelector<HTMLElement>(
            "[data-js-cartRendered]",
        );
        if (
            !rendered?.dataset.cartRevision ||
            !state.acceptRenderedRevision(
                rendered.dataset.cartRevision,
                readCart(),
            )
        ) {
            errorElement.textContent =
                "The cart changed. Review the latest quantities before submitting.";
            return;
        }

        const nameInput = contents.querySelector<HTMLInputElement>(
            '[data-js-checkoutForm] input[name="customerName"]',
        );
        if (nameInput) nameInput.value = customerName;
        errorElement.textContent = "";
    }

    function handleResponseError(event: Event) {
        const token = refreshToken(htmxContext(event)?.sourceEvent);
        if (!token || !state.isCurrentRender(token, readCart())) return;
        contents.replaceChildren();
        errorElement.textContent = "Could not load the cart.";
    }

    function handleContentsClick(event: Event) {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const item = target.closest<HTMLElement>("[data-js-cartItem]");
        if (!item) return;
        const inventoryId = Number(item.dataset.inventoryId);
        const input = item.querySelector<HTMLInputElement>(
            "[data-js-cartQuantity]",
        );
        if (!Number.isSafeInteger(inventoryId) || !input) return;

        if (target.closest("[data-js-cartRemove]")) {
            void changeQuantity(inventoryId, 0);
        } else if (target.closest("[data-js-cartDecrease]")) {
            void changeQuantity(
                inventoryId,
                Math.max(1, Number(input.value) - 1),
            );
        } else if (target.closest("[data-js-cartIncrease]")) {
            void changeQuantity(
                inventoryId,
                limitedQuantity(Number(input.value) + 1, item),
            );
        }
    }

    function handleQuantityChange(event: Event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (!input.matches("[data-js-cartQuantity]")) return;
        const item = input.closest<HTMLElement>("[data-js-cartItem]");
        const inventoryId = Number(item?.dataset.inventoryId);
        const quantity = Number(input.value);
        if (
            !item ||
            !Number.isSafeInteger(inventoryId) ||
            !Number.isSafeInteger(quantity) ||
            quantity < 1
        ) {
            refresh();
            return;
        }
        void changeQuantity(inventoryId, limitedQuantity(quantity, item));
    }

    function limitedQuantity(quantity: number, item: HTMLElement) {
        const maximum = Number(item.dataset.maxQuantity);
        return Number.isSafeInteger(maximum) && maximum > 0
            ? Math.min(maximum, quantity)
            : quantity;
    }

    async function changeQuantity(inventoryId: number, quantity: number) {
        await setCartQuantity(inventoryId, quantity);
        document.dispatchEvent(new CustomEvent("cartchange"));
        refresh();
    }

    async function submitOrder(event: SubmitEvent) {
        const checkoutForm = event.target;
        if (
            !(checkoutForm instanceof HTMLFormElement) ||
            !checkoutForm.matches("[data-js-checkoutForm]")
        ) {
            return;
        }
        event.preventDefault();
        if (!checkoutForm.reportValidity()) return;

        const renderedCart = readCart();
        if (!state.canSubmit(renderedCart)) {
            errorElement.textContent =
                "The cart changed. Review the latest quantities before submitting.";
            refresh();
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
                errorElement.textContent =
                    "The cart changed. Review the latest quantities before submitting.";
                refresh();
                return;
            }
            const items = Object.entries(checkout.cart).map(
                ([inventoryId, quantity]) => ({
                    inventoryId: Number(inventoryId),
                    quantity,
                }),
            );
            if (items.length === 0 || !window.confirm("Submit this order?")) {
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
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }
}

function errorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}
