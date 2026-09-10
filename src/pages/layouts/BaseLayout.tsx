import { html, Html } from "@elysia/html";

export function BaseLayout(props: { children?: JSX.Element | JSX.Element[] }) {
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
                <script src="/public/htmx.min.js"></script>
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
            <body>{props.children}</body>
        </html>
    );
}
