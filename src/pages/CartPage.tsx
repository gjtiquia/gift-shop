import { html, Html } from "@elysia/html";
import { PageLayout } from "./layouts/PageLayout";

export function CartPage() {
    return (
        <PageLayout
            title="Cart"
            actions={
                <>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/orders"
                    >
                        History
                    </a>
                    <a
                        class="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                        href="/"
                    >
                        Catalogue
                    </a>
                </>
            }
        >
            <section class="grid gap-6" data-js-cartPage>
                <form
                    hidden
                    data-js-cartContentsForm
                    hx-post="/cart/contents"
                    hx-target="[data-js-cartContents]"
                    hx-swap="innerHTML"
                    hx-sync="this:replace"
                >
                    <input name="cart" data-js-cartPayload />
                </form>
                <p class="text-gray-600" data-js-cartLoading>
                    Loading cart…
                </p>
                <div data-js-cartContents></div>
                <p
                    class="font-medium text-red-700"
                    role="alert"
                    data-js-cartError
                ></p>
                <form
                    class="grid max-w-md gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    data-js-checkoutForm
                    hidden
                >
                    <label class="grid gap-1 text-sm font-medium text-gray-800">
                        Customer name
                        <input
                            class="rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                            name="customerName"
                            maxlength="200"
                            required
                        />
                    </label>
                    <button
                        class="rounded-md bg-gray-950 px-4 py-2 font-medium text-white disabled:bg-gray-400"
                        type="submit"
                    >
                        Submit order
                    </button>
                </form>
            </section>
        </PageLayout>
    );
}
