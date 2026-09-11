import { orderHistoryStorageKey, readOrderHistory } from "./cartStorage";

for (const page of document.querySelectorAll<HTMLElement>(
    "[data-js-ordersPage]",
)) {
    setupOrdersPage(page);
}

function setupOrdersPage(page: HTMLElement) {
    const form = page.querySelector<HTMLFormElement>(
        "[data-js-ordersHistoryForm]",
    );
    const payload = page.querySelector<HTMLInputElement>(
        "[data-js-ordersHistoryPayload]",
    );
    const loading = page.querySelector<HTMLElement>("[data-js-ordersLoading]");
    const error = page.querySelector<HTMLElement>("[data-js-ordersError]");
    const list = page.querySelector<HTMLElement>("[data-js-ordersList]");
    if (!form || !payload || !loading || !error || !list) return;

    const load = () => {
        payload.value = JSON.stringify(readOrderHistory());
        form.requestSubmit();
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load, { once: true });
    } else {
        load();
    }
    window.addEventListener("storage", (event) => {
        if (event.key === orderHistoryStorageKey) load();
    });

    document.body.addEventListener("htmx:afterSwap", (event) => {
        const target = (event as CustomEvent<{ target?: Element }>).detail
            ?.target;
        if (target !== list) return;
        loading.textContent = "";
        error.textContent = "";
    });
    document.body.addEventListener("htmx:responseError", (event) => {
        const detail = (
            event as CustomEvent<{ elt?: Element; target?: Element }>
        ).detail;
        if (detail?.elt !== form && detail?.target !== list) return;
        loading.textContent = "";
        error.textContent = "Could not load order history.";
    });
}
