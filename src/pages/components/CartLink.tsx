import { html, Html } from "@elysia/html";

export function CartLink({
    count,
    oob = false,
}: {
    count: number;
    oob?: boolean;
}) {
    return (
        <a
            id="cart-link"
            class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
            href="/cart"
            hx-swap-oob={oob ? "outerHTML" : undefined}
        >
            {count > 0 ? `Cart (${count})` : "Cart"}
        </a>
    );
}
