import { expect, test } from "bun:test";
import {
    isSuccessfulHtmxResponse,
    PartialRefreshState,
    refreshToken,
    whenHtmxInitialized,
} from "./partialRefreshState";

test("initial refresh waits for HTMX initialization and runs once", () => {
    class HtmxTarget extends EventTarget {
        powered = false;

        hasAttribute(name: string) {
            return name === "data-htmx-powered" && this.powered;
        }
    }

    const target = new HtmxTarget();
    const requests: string[] = [];
    let storedPayload = '{"7":2}';
    target.addEventListener("cart-refresh", (event) => {
        requests.push(
            (event as CustomEvent<{ payload: string }>).detail.payload,
        );
    });
    whenHtmxInitialized(target, () => {
        target.dispatchEvent(
            new CustomEvent("cart-refresh", {
                detail: { payload: storedPayload },
            }),
        );
    });

    storedPayload = '{"7":3}';
    expect(requests).toEqual([]);
    target.powered = true;
    target.dispatchEvent(new CustomEvent("htmx:after:init"));
    target.dispatchEvent(new CustomEvent("htmx:after:init"));
    expect(requests).toEqual(['{"7":3}']);
});

test("already initialized HTMX targets refresh immediately", () => {
    const target = Object.assign(new EventTarget(), {
        hasAttribute: (name: string) => name === "data-htmx-powered",
    });
    let requests = 0;
    whenHtmxInitialized(target, () => requests++);
    expect(requests).toBe(1);
});

test("partial refresh state rejects older responses", () => {
    const state = new PartialRefreshState();
    const older = state.begin('["older"]');
    const current = state.begin('["current"]');

    expect(state.isCurrent(older, '["current"]')).toBe(false);
    expect(state.isCurrent(current, '["current"]')).toBe(true);
    expect(state.isCurrent(current, '["changed"]')).toBe(false);
});

test("HTMX error responses are not swappable", () => {
    expect(isSuccessfulHtmxResponse({ response: { status: 200 } })).toBe(true);
    expect(isSuccessfulHtmxResponse({ response: { status: 399 } })).toBe(true);
    expect(isSuccessfulHtmxResponse({ response: { status: 400 } })).toBe(false);
    expect(isSuccessfulHtmxResponse({ response: { status: 500 } })).toBe(false);
    expect(isSuccessfulHtmxResponse(undefined)).toBe(false);
});

test("refresh metadata is validated before freshness checks", () => {
    expect(
        refreshToken(
            new CustomEvent("refresh", {
                detail: { generation: 2, revision: "current" },
            }),
        ),
    ).toEqual({ generation: 2, revision: "current" });
    expect(
        refreshToken(
            new CustomEvent("refresh", {
                detail: { generation: "2", revision: "current" },
            }),
        ),
    ).toBeNull();
});
