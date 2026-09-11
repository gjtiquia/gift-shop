import { html, Html } from "@elysia/html";

interface BaseLayoutProps {
    children?: JSX.Element | JSX.Element[];
    enableHtmx?: boolean;
}

export function BaseLayout({ children, enableHtmx }: BaseLayoutProps) {
    const version = process.env.VERSION;

    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width" />
                <link
                    rel="icon"
                    type="image/svg+xml"
                    href="/public/favicon.svg"
                />
                {enableHtmx ? (
                    <script defer src="/public/htmx.min.js"></script>
                ) : null}
                <link
                    rel="stylesheet"
                    href={`/public/styles.css?v=${version}`}
                />
                <script
                    type="module"
                    src={`/public/index.js?v=${version}`}
                ></script>
                <title>Gift Shop</title>
            </head>
            <body>{children}</body>
        </html>
    );
}
