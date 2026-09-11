import {
    addToCart,
    cartStorageKey,
    cartUnitCount,
    readCart,
} from "./cartStorage";

updateCartLinks();
setupCatalogue();
window.addEventListener("storage", (event) => {
    if (event.key === cartStorageKey) updateCartLinks();
});
document.addEventListener("cartchange", updateCartLinks);

function updateCartLinks() {
    const count = cartUnitCount(readCart());
    for (const link of document.querySelectorAll<HTMLElement>(
        "[data-js-cartLink]",
    )) {
        link.textContent = count > 0 ? `Cart (${count})` : "Cart";
    }
}

function setupCatalogue() {
    for (const item of document.querySelectorAll<HTMLElement>(
        "[data-js-catalogueItem]",
    )) {
        const input = item.querySelector<HTMLInputElement>(
            "[data-js-quantityInput]",
        );
        const decrease = item.querySelector<HTMLButtonElement>(
            "[data-js-quantityDecrease]",
        );
        const increase = item.querySelector<HTMLButtonElement>(
            "[data-js-quantityIncrease]",
        );
        const add = item.querySelector<HTMLButtonElement>(
            "[data-js-addToCart]",
        );
        const message = item.querySelector<HTMLElement>(
            "[data-js-addedMessage]",
        );
        const inventoryId = Number(item.dataset.inventoryId);
        const maximum = Number(item.dataset.maxQuantity);
        if (!input || !decrease || !increase || !add || !message) continue;

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

function validQuantity(input: HTMLInputElement, maximum: number) {
    const quantity = Number(input.value);
    if (!Number.isSafeInteger(quantity)) return 1;
    return Math.max(1, Math.min(maximum, quantity));
}

function normalizeInput(input: HTMLInputElement, maximum: number) {
    input.value = String(validQuantity(input, maximum));
}
