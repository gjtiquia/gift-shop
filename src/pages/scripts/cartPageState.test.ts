import { expect, test } from "bun:test";
import { cartRevision } from "./cartStorage";
import { CartPageState } from "./cartPageState";

test("a delayed render cannot replace a newer shared-cart render", async () => {
    const state = new CartPageState();
    const firstCart = { "1": 1 };
    const delayedRender = state.beginRender(firstCart);
    let finishDelayedFetch: () => void = () => {};
    const delayedFetch = new Promise<void>((resolve) => {
        finishDelayedFetch = resolve;
    });
    const delayedCompletion = delayedFetch.then(() =>
        state.acceptRender(delayedRender, firstCart),
    );

    const latestCart = { "1": 2, "3": 1 };
    const latestRender = state.beginRender(latestCart);
    expect(state.acceptRender(latestRender, latestCart)).toBe(true);
    finishDelayedFetch();

    expect(await delayedCompletion).toBe(false);
    expect(state.canSubmit(latestCart)).toBe(true);
});

test("submission requires the current cart to have completed rendering", () => {
    const state = new CartPageState();
    const cart = { "1": 2 };
    const render = state.beginRender(cart);

    expect(state.canSubmit(cart)).toBe(false);
    expect(state.acceptRender(render, cart)).toBe(true);
    expect(state.canSubmit(cart)).toBe(true);
    state.beginRender({ "1": 2, "4": 1 });
    expect(state.canSubmit(cart)).toBe(false);
});

test("cart revisions are stable regardless of key insertion order", () => {
    expect(cartRevision({ "10": 1, "2": 3 })).toBe(
        cartRevision({ "2": 3, "10": 1 }),
    );
});
