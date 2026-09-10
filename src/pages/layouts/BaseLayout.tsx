import { html, Html } from "@elysia/html";

export function BaseLayout(props: { children?: JSX.Element | JSX.Element[] }) {
    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <script src="/htmx.min.js"></script>
                {/* <link rel="stylesheet" href="/styles.css" /> */}
                {/* <script type="module" src="/index.js"></script> */}
                <title>Gift Shop</title>
            </head>
            <body
                hx-on--after-request="if (event.detail.successful) document.querySelector('#inventory-error')?.replaceChildren()"
                hx-on--response-error="document.querySelector('#inventory-error')?.replaceChildren(event.detail.xhr.responseText)"
            >
                {props.children}
            </body>
        </html>
    );
}
