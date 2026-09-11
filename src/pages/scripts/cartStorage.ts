export const cartStorageKey = "giftShop.cart.v1";
export const orderHistoryStorageKey = "giftShop.orderHistory.v1";
export const checkoutStorageKey = "giftShop.checkoutId.v1";

export type Cart = Record<string, number>;

export interface CartLock {
    run<T>(operation: () => T): Promise<T>;
}

const cartLockName = "giftShop.cart.lock.v1";
const fallbackLockStorageKey = "giftShop.cartLock.v1";
const fallbackRequestStoragePrefix = "giftShop.cartLockRequest.v1.";
const fallbackLeaseMilliseconds = 5_000;

export const browserCartLock: CartLock = {
    run<T>(operation: () => T) {
        if (typeof navigator !== "undefined" && navigator.locks) {
            return navigator.locks.request(cartLockName, operation);
        }
        return withFallbackCartLock(operation);
    },
};

export function readCart(
    storage: Pick<Storage, "getItem"> = localStorage,
): Cart {
    try {
        const parsed: unknown = JSON.parse(
            storage.getItem(cartStorageKey) ?? "{}",
        );
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const cart: Cart = {};
        for (const [id, quantity] of Object.entries(parsed)) {
            if (
                /^\d+$/.test(id) &&
                Number(id) > 0 &&
                Number.isSafeInteger(quantity) &&
                Number(quantity) > 0
            ) {
                cart[id] = Number(quantity);
            }
        }
        return cart;
    } catch {
        return {};
    }
}

export function setCartQuantity(
    inventoryId: number,
    quantity: number,
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
    lock: CartLock = browserCartLock,
) {
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

export function addToCart(
    inventoryId: number,
    quantity: number,
    maximum: number,
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
    lock: CartLock = browserCartLock,
) {
    return lock.run(() => {
        const cart = readCart(storage);
        cart[String(inventoryId)] = Math.min(
            maximum,
            (cart[String(inventoryId)] ?? 0) + quantity,
        );
        writeCartWithoutLock(cart, storage);
        return cart;
    });
}

export function beginCheckout(
    renderedRevision: string,
    storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
    lock: CartLock = browserCartLock,
) {
    return lock.run(() => {
        const cart = readCart(storage);
        if (cartRevision(cart) !== renderedRevision) {
            return { status: "cart-changed" as const };
        }
        const existing = readCheckoutSubmission(storage);
        if (existing?.revision === renderedRevision) {
            return {
                status: "success" as const,
                id: existing.id,
                revision: renderedRevision,
                cart,
            };
        }
        const id = crypto.randomUUID();
        storage.setItem(
            checkoutStorageKey,
            JSON.stringify({ id, revision: renderedRevision }),
        );
        return {
            status: "success" as const,
            id,
            revision: renderedRevision,
            cart,
        };
    });
}

export function clearCartAfterSubmit(
    submittedRevision: string,
    submissionId: string,
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
    lock: CartLock = browserCartLock,
) {
    return lock.run(() => {
        const checkout = readCheckoutSubmission(storage);
        if (
            cartRevision(readCart(storage)) !== submittedRevision ||
            checkout?.revision !== submittedRevision ||
            checkout.id !== submissionId
        ) {
            return false;
        }
        writeCartWithoutLock({}, storage);
        return true;
    });
}

export function cartRevision(cart: Cart) {
    return JSON.stringify(
        Object.entries(cart).sort(
            ([first], [second]) => Number(first) - Number(second),
        ),
    );
}

export function cartUnitCount(cart: Cart) {
    return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
}

export function readOrderHistory(
    storage: Pick<Storage, "getItem"> = localStorage,
) {
    try {
        const parsed: unknown = JSON.parse(
            storage.getItem(orderHistoryStorageKey) ?? "[]",
        );
        if (!Array.isArray(parsed)) return [];
        return Array.from(
            new Set(
                parsed.filter(
                    (id): id is string =>
                        typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id),
                ),
            ),
        ).slice(0, 100);
    } catch {
        return [];
    }
}

export function rememberOrder(
    orderId: string,
    storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
    lock: CartLock = browserCartLock,
) {
    return lock.run(() => {
        const history = readOrderHistory(storage).filter(
            (id) => id !== orderId,
        );
        storage.setItem(
            orderHistoryStorageKey,
            JSON.stringify([orderId, ...history].slice(0, 100)),
        );
    });
}

function readCheckoutSubmission(storage: Pick<Storage, "getItem">) {
    try {
        const value = JSON.parse(
            storage.getItem(checkoutStorageKey) ?? "null",
        ) as { id?: unknown; revision?: unknown } | null;
        if (
            !value ||
            typeof value.id !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(value.id) ||
            typeof value.revision !== "string"
        ) {
            return null;
        }
        return { id: value.id, revision: value.revision };
    } catch {
        return null;
    }
}

function writeCartWithoutLock(
    cart: Cart,
    storage: Pick<Storage, "setItem" | "removeItem">,
) {
    const clean = sanitizeCart(cart);
    if (Object.keys(clean).length === 0) storage.removeItem(cartStorageKey);
    else storage.setItem(cartStorageKey, JSON.stringify(clean));
    storage.removeItem(checkoutStorageKey);
}

async function withFallbackCartLock<T>(operation: () => T): Promise<T> {
    const owner = crypto.randomUUID();
    const requestKey = `${fallbackRequestStoragePrefix}${owner}`;
    const requestedAt = Date.now();
    let storageAvailable = true;
    try {
        localStorage.setItem(
            requestKey,
            JSON.stringify({
                owner,
                requestedAt,
                expiresAt: requestedAt + fallbackLeaseMilliseconds,
            }),
        );
        while (true) {
            const now = Date.now();
            localStorage.setItem(
                requestKey,
                JSON.stringify({
                    owner,
                    requestedAt,
                    expiresAt: now + fallbackLeaseMilliseconds,
                }),
            );
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

            localStorage.setItem(
                fallbackLockStorageKey,
                JSON.stringify({
                    owner,
                    expiresAt: now + fallbackLeaseMilliseconds,
                }),
            );
            await delay(20 + Math.random() * 20);
            if (
                readFallbackLease()?.owner === owner &&
                readFallbackRequests(Date.now())[0]?.owner === owner
            ) {
                break;
            }
            if (readFallbackLease()?.owner === owner) {
                localStorage.removeItem(fallbackLockStorageKey);
            }
        }
    } catch {
        // If lock storage itself is unavailable, retain the pre-lock behavior
        // rather than making the cart unusable.
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
            } catch {
                // The cart operation completed; abandoned lock data expires.
            }
        }
    }
}

function readFallbackRequests(now: number) {
    const requests: Array<{
        key: string;
        owner: string;
        requestedAt: number;
    }> = [];
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(fallbackRequestStoragePrefix)) continue;
        try {
            const value = JSON.parse(localStorage.getItem(key) ?? "null") as {
                owner?: unknown;
                requestedAt?: unknown;
                expiresAt?: unknown;
            } | null;
            if (
                !value ||
                typeof value.owner !== "string" ||
                typeof value.requestedAt !== "number" ||
                typeof value.expiresAt !== "number"
            ) {
                localStorage.removeItem(key);
                index--;
            } else if (value.expiresAt <= now) {
                localStorage.removeItem(key);
                index--;
            } else {
                requests.push({
                    key,
                    owner: value.owner,
                    requestedAt: value.requestedAt,
                });
            }
        } catch {
            localStorage.removeItem(key);
            index--;
        }
    }
    return requests.sort(
        (first, second) =>
            first.requestedAt - second.requestedAt ||
            first.owner.localeCompare(second.owner),
    );
}

function readFallbackLease() {
    try {
        const parsed: unknown = JSON.parse(
            localStorage.getItem(fallbackLockStorageKey) ?? "null",
        );
        if (!parsed || typeof parsed !== "object") return null;
        const lease = parsed as { owner?: unknown; expiresAt?: unknown };
        if (
            typeof lease.owner !== "string" ||
            typeof lease.expiresAt !== "number"
        ) {
            return null;
        }
        return { owner: lease.owner, expiresAt: lease.expiresAt };
    } catch {
        return null;
    }
}

function delay(milliseconds: number) {
    return new Promise<void>((resolve) =>
        window.setTimeout(resolve, milliseconds),
    );
}

function sanitizeCart(cart: Cart) {
    const clean: Cart = {};
    for (const [id, quantity] of Object.entries(cart)) {
        if (
            /^\d+$/.test(id) &&
            Number(id) > 0 &&
            Number.isSafeInteger(quantity) &&
            quantity > 0
        ) {
            clean[id] = quantity;
        }
    }
    return clean;
}
