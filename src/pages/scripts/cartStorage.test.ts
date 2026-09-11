import { expect, test } from "bun:test";
import {
    addToCart,
    cartRevision,
    cartStorageKey,
    beginCheckout,
    cartUnitCount,
    clearCartAfterSubmit,
    readCart,
    readOrderHistory,
    rememberOrder,
    setCartQuantity,
    type CartLock,
} from "./cartStorage";

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key: string) {
            return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
            values.set(key, value);
        },
        removeItem(key: string) {
            values.delete(key);
        },
    };
}

test("cart storage ignores malformed entries and counts total units", () => {
    const storage = memoryStorage({
        [cartStorageKey]: JSON.stringify({
            "1": 2,
            "2": 3,
            "-1": 10,
            nope: 4,
            "3": 0,
            "4": 1.5,
        }),
    });

    const cart = readCart(storage);
    expect(cart).toEqual({ "1": 2, "2": 3 });
    expect(cartUnitCount(cart)).toBe(5);
});

test("adding merges and clamps to current inventory", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();

    await addToCart(7, 2, 5, storage, lock);
    expect(await addToCart(7, 4, 5, storage, lock)).toEqual({ "7": 5 });
    expect(await setCartQuantity(7, 0, storage, lock)).toEqual({});
});

test("concurrent ordinary cart updates are serialized", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();

    await Promise.all([
        addToCart(7, 1, 5, storage, lock),
        addToCart(7, 1, 5, storage, lock),
    ]);

    expect(readCart(storage)).toEqual({ "7": 2 });
});

test("checkout compare-and-clear cannot erase a competing cart write", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    await setCartQuantity(1, 2, storage, lock);
    const submittedRevision = cartRevision(readCart(storage));
    const checkout = await beginCheckout(submittedRevision, storage, lock);
    if (checkout.status !== "success")
        throw new Error("checkout was not ready");

    const competingWrite = setCartQuantity(4, 1, storage, lock);
    const clear = clearCartAfterSubmit(
        submittedRevision,
        checkout.id,
        storage,
        lock,
    );
    await competingWrite;

    expect(await clear).toBe(false);
    expect(readCart(storage)).toEqual({ "1": 2, "4": 1 });
});

test("a cart write queued after checkout clearing remains present", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    await setCartQuantity(1, 2, storage, lock);
    const submittedRevision = cartRevision(readCart(storage));
    const checkout = await beginCheckout(submittedRevision, storage, lock);
    if (checkout.status !== "success")
        throw new Error("checkout was not ready");

    const clear = clearCartAfterSubmit(
        submittedRevision,
        checkout.id,
        storage,
        lock,
    );
    const competingWrite = setCartQuantity(4, 1, storage, lock);

    expect(await clear).toBe(true);
    await competingWrite;
    expect(readCart(storage)).toEqual({ "4": 1 });
});

test("checkout IDs are atomically bound to their cart revision", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    await setCartQuantity(1, 1, storage, lock);
    const firstRevision = cartRevision(readCart(storage));

    await setCartQuantity(2, 1, storage, lock);
    const secondRevision = cartRevision(readCart(storage));
    const secondCheckout = await beginCheckout(secondRevision, storage, lock);
    const staleFirstCheckout = await beginCheckout(
        firstRevision,
        storage,
        lock,
    );

    expect(secondCheckout.status).toBe("success");
    expect(staleFirstCheckout).toEqual({ status: "cart-changed" });
    if (secondCheckout.status !== "success") {
        throw new Error("checkout was not ready");
    }
    expect(
        await clearCartAfterSubmit(
            firstRevision,
            secondCheckout.id,
            storage,
            lock,
        ),
    ).toBe(false);
    expect(readCart(storage)).toEqual({ "1": 1, "2": 1 });
});

test("checkout begun before confirmation preserves an ABA-rebuilt cart", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    await setCartQuantity(1, 2, storage, lock);
    const submittedRevision = cartRevision(readCart(storage));
    const submittedCheckout = await beginCheckout(
        submittedRevision,
        storage,
        lock,
    );
    if (submittedCheckout.status !== "success") {
        throw new Error("checkout was not ready");
    }
    expect(submittedCheckout.cart).toEqual({ "1": 2 });

    // Another tab changes and rebuilds the cart while confirmation is open.
    await setCartQuantity(4, 1, storage, lock);
    await setCartQuantity(4, 0, storage, lock);
    expect(cartRevision(readCart(storage))).toBe(submittedRevision);
    const rebuiltCheckout = await beginCheckout(
        submittedRevision,
        storage,
        lock,
    );
    if (rebuiltCheckout.status !== "success") {
        throw new Error("checkout was not ready");
    }
    expect(rebuiltCheckout.id).not.toBe(submittedCheckout.id);

    expect(
        await clearCartAfterSubmit(
            submittedRevision,
            submittedCheckout.id,
            storage,
            lock,
        ),
    ).toBe(false);
    expect(readCart(storage)).toEqual({ "1": 2 });
});

test("the same cart revision reuses its checkout ID", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    await setCartQuantity(1, 1, storage, lock);
    const revision = cartRevision(readCart(storage));

    const first = await beginCheckout(revision, storage, lock);
    const second = await beginCheckout(revision, storage, lock);

    expect(first.status).toBe("success");
    expect(second).toEqual(first);
});

test("order history is newest first and de-duplicated", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";

    await rememberOrder(first, storage, lock);
    await rememberOrder(second, storage, lock);
    await rememberOrder(first, storage, lock);

    expect(readOrderHistory(storage)).toEqual([first, second]);
});

test("concurrent order history updates retain both orders", async () => {
    const storage = memoryStorage();
    const lock = queuedLock();
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";

    await Promise.all([
        rememberOrder(first, storage, lock),
        rememberOrder(second, storage, lock),
    ]);

    expect(readOrderHistory(storage)).toEqual([second, first]);
});

function queuedLock(): CartLock {
    let tail: Promise<unknown> = Promise.resolve();
    return {
        run<T>(operation: () => T) {
            const result = tail.then(operation);
            tail = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        },
    };
}
