interface HtmxRequestContext {
    response?: { status?: number };
    sourceElement?: Element;
}

document.addEventListener("htmx:before:swap", (event) => {
    const context = htmxContext(event);
    if ((context?.response?.status ?? 0) < 500) return;

    event.preventDefault();
    showUnexpectedError(event, context);
});

document.addEventListener("htmx:error", (event) => {
    const context = htmxContext(event);
    if (context?.response) return;
    showUnexpectedError(event, context);
});

function showUnexpectedError(
    event: Event,
    context: HtmxRequestContext | undefined,
) {
    const source =
        context?.sourceElement ??
        (event.target instanceof Element ? event.target : null);
    const owner = source?.closest<HTMLElement>("[data-htmx-error]");
    const selector = owner?.dataset.htmxError;
    if (!selector) return;

    const error = document.querySelector<HTMLElement>(selector);
    if (error) error.textContent = "Could not complete the request. Try again.";
}

function htmxContext(event: Event) {
    return (event as CustomEvent<{ ctx?: HtmxRequestContext }>).detail?.ctx;
}
