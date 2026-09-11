import { html, Html } from "@elysia/html";
import { BaseLayout } from "./BaseLayout";

interface PageLayoutProps {
    title: string;
    children?: JSX.Element | JSX.Element[];
    actions?: JSX.Element | JSX.Element[];
    footerActions?: JSX.Element | JSX.Element[];
    width?: "narrow" | "wide";
}

const contentWidths = {
    narrow: "max-w-md",
    wide: "max-w-7xl",
};

export function PageLayout({
    title,
    children,
    actions,
    footerActions,
    width = "wide",
}: PageLayoutProps) {
    return (
        <BaseLayout title={`${title} | Gift Shop`}>
            <div class="flex min-h-screen flex-col bg-gray-50 text-gray-950">
                <header class="border-b border-gray-200 bg-white">
                    <div class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                        <div>
                            <a
                                class="text-sm font-semibold tracking-wide text-gray-500 uppercase hover:text-gray-800"
                                href="/"
                            >
                                Gift Shop
                            </a>
                            <h1 class="text-2xl font-semibold tracking-tight">
                                {title}
                            </h1>
                        </div>
                        {actions ? (
                            <nav
                                class="flex flex-wrap items-center gap-3"
                                aria-label="Page navigation"
                            >
                                {actions}
                            </nav>
                        ) : (
                            <></>
                        )}
                    </div>
                </header>
                <main
                    class={`mx-auto grid w-full ${contentWidths[width]} flex-1 content-start gap-6 px-4 py-8 sm:px-6 lg:px-8`}
                >
                    {children}
                </main>
                {footerActions ? (
                    <footer class="mx-auto w-full max-w-7xl px-4 pb-4 text-right sm:px-6 lg:px-8">
                        {footerActions}
                    </footer>
                ) : (
                    <></>
                )}
            </div>
        </BaseLayout>
    );
}
