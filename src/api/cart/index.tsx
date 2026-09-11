import { Elysia } from "elysia";
import { html, Html } from "@elysia/html";
import { isValidCsrfRequest } from "../../auth/csrf";
import { CartContents } from "../../pages/components/CartContents";
import { CartLink } from "../../pages/components/CartLink";
import {
    getOrCreateVisitorSession,
    visitorSessionCookieName,
} from "../../visitor/session";
import {
    addCartItem,
    adjustCartItemQuantity,
    getCartItems,
    removeCartItem,
    setCartItemQuantity,
    type CartMutationResult,
} from "./service";

export const cart = new Elysia({ prefix: "cart" })
    .post("/items/:id/add", async (context) => {
        const input = await cartRequest(context);
        if (input instanceof Response) return input;
        const result = await addCartItem(
            input.visitorId,
            Number(context.params.id),
            input.quantity,
        );
        if (result.status === "invalid") {
            return invalidCartResponse(
                context.request,
                result,
                `#cart-message-${context.params.id}`,
                "/",
            );
        }
        if (!isHtmxRequest(context.request)) return context.redirect("/", 303);

        const items = await getCartItems(input.visitorId);
        return (
            <>
                Added
                <CartLink count={cartCount(items)} oob />
            </>
        );
    })
    .post("/items/:id", async (context) => {
        const input = await cartRequest(context);
        if (input instanceof Response) return input;
        return cartPageMutation(
            context,
            input.visitorId,
            await setCartItemQuantity(
                input.visitorId,
                Number(context.params.id),
                input.quantity,
            ),
        );
    })
    .post("/items/:id/decrease", async (context) => {
        const input = await cartRequest(context, false);
        if (input instanceof Response) return input;
        return cartPageMutation(
            context,
            input.visitorId,
            await adjustCartItemQuantity(
                input.visitorId,
                Number(context.params.id),
                -1,
            ),
        );
    })
    .post("/items/:id/increase", async (context) => {
        const input = await cartRequest(context, false);
        if (input instanceof Response) return input;
        return cartPageMutation(
            context,
            input.visitorId,
            await adjustCartItemQuantity(
                input.visitorId,
                Number(context.params.id),
                1,
            ),
        );
    })
    .post("/items/:id/remove", async (context) => {
        const input = await cartRequest(context, false);
        if (input instanceof Response) return input;
        return cartPageMutation(
            context,
            input.visitorId,
            await removeCartItem(input.visitorId, Number(context.params.id)),
        );
    });

async function cartRequest(
    context: {
        body: unknown;
        cookie: Record<string, unknown>;
        request: Request;
    },
    hasQuantity = true,
) {
    if (!isValidCsrfRequest(context.request)) {
        return new Response(null, { status: 403 });
    }
    const visitor = await getOrCreateVisitorSession(
        context.cookie[visitorSessionCookieName] as Parameters<
            typeof getOrCreateVisitorSession
        >[0],
        context.request,
    );
    if (!hasQuantity) return { visitorId: visitor.id, quantity: 0 };

    const body = context.body as { quantity?: unknown } | null;
    return {
        visitorId: visitor.id,
        quantity: Number(body?.quantity),
    };
}

async function cartPageMutation(
    context: {
        request: Request;
        redirect: (location: string, status?: 303) => Response;
    },
    visitorId: string,
    result: CartMutationResult,
) {
    if (result.status === "invalid") {
        return invalidCartResponse(
            context.request,
            result,
            "#cart-error",
            "/cart?error=invalid",
        );
    }
    if (!isHtmxRequest(context.request)) {
        return context.redirect("/cart", 303);
    }

    const items = await getCartItems(visitorId);
    return (
        <>
            <CartContents items={items} submissionId={crypto.randomUUID()} />
            <CartLink count={cartCount(items)} oob />
        </>
    );
}

function invalidCartResponse(
    request: Request,
    result: Extract<CartMutationResult, { status: "invalid" }>,
    target: string,
    fallbackLocation: string,
) {
    if (!isHtmxRequest(request)) {
        return new Response(null, {
            status: 303,
            headers: { location: fallbackLocation },
        });
    }
    return new Response(result.message, {
        status: 422,
        headers: {
            "content-type": "text/plain; charset=utf-8",
            "HX-Retarget": target,
            "HX-Reswap": "textContent",
        },
    });
}

function cartCount(items: Array<{ quantity: number }>) {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}

function isHtmxRequest(request: Request) {
    return request.headers.get("HX-Request") === "true";
}
