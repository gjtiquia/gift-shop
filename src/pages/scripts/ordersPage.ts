import { orderHistoryStorageKey, readOrderHistory } from "./cartStorage";
import {
    htmxContext,
    isSuccessfulHtmxResponse,
    PartialRefreshState,
    refreshToken,
    whenHtmxInitialized,
} from "./partialRefreshState";

for (const page of document.querySelectorAll<HTMLElement>(
    "[data-js-ordersPage]",
)) {
    setupOrdersPage(page);
}

function setupOrdersPage(page: HTMLElement) {
    const payload = page.querySelector<HTMLInputElement>(
        "[data-js-ordersHistoryPayload]",
    );
    const list = page.querySelector<HTMLElement>("[data-js-ordersList]");
    const error = page.querySelector<HTMLElement>("[data-js-ordersError]");
    if (!payload || !list || !error) return;

    const state = new PartialRefreshState();
    const load = () => {
        const revision = JSON.stringify(readOrderHistory());
        const token = state.begin(revision);
        payload.value = revision;
        error.textContent = "";
        list.dispatchEvent(
            new CustomEvent("order-history-refresh", {
                bubbles: true,
                detail: token,
            }),
        );
    };
    whenHtmxInitialized(list, load);
    window.addEventListener("storage", (event) => {
        if (event.key === orderHistoryStorageKey) load();
    });

    list.addEventListener("htmx:before:swap", (event) => {
        const context = htmxContext(event);
        const token = refreshToken(context?.sourceEvent);
        const currentRevision = JSON.stringify(readOrderHistory());
        if (
            !isSuccessfulHtmxResponse(context) ||
            !token ||
            !state.isCurrent(token, currentRevision)
        ) {
            event.preventDefault();
        }
    });
    list.addEventListener("htmx:after:swap", (event) => {
        const token = refreshToken(htmxContext(event)?.sourceEvent);
        if (
            !token ||
            !state.isCurrent(token, JSON.stringify(readOrderHistory()))
        ) {
            return;
        }
        error.textContent = "";
    });
    list.addEventListener("htmx:response:error", (event) => {
        const token = refreshToken(htmxContext(event)?.sourceEvent);
        if (
            !token ||
            !state.isCurrent(token, JSON.stringify(readOrderHistory()))
        ) {
            return;
        }
        list.replaceChildren();
        error.textContent = "Could not load order history.";
    });
}
