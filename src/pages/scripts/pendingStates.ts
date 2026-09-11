interface HtmxRequestContext {
    sourceElement?: Element;
}

const requestRegions = new WeakMap<object, HTMLElement>();
const activeRequests = new WeakMap<HTMLElement, number>();

document.addEventListener("htmx:before:request", (event) => {
    const context = htmxContext(event);
    const source = context?.sourceElement;
    const region = source?.closest<HTMLElement>("[data-loading-region]");
    if (!context || !region) return;

    requestRegions.set(context, region);
    const count = (activeRequests.get(region) ?? 0) + 1;
    activeRequests.set(region, count);
    setRegionPending(region, true);
});

document.addEventListener("htmx:finally:request", (event) => {
    const context = htmxContext(event);
    if (!context) return;

    const region = requestRegions.get(context);
    if (!region) return;

    requestRegions.delete(context);
    const count = Math.max(0, (activeRequests.get(region) ?? 1) - 1);
    if (count > 0) {
        activeRequests.set(region, count);
        return;
    }

    activeRequests.delete(region);
    setRegionPending(region, false);
});

document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest<HTMLAnchorElement>(
        "a[data-pending-navigation-disabled]",
    );
    if (link) event.preventDefault();
});

document.addEventListener("submit", (event) => {
    if (event.defaultPrevented) return;

    const form = event.target;
    if (
        !(form instanceof HTMLFormElement) ||
        !form.hasAttribute("data-native-pending")
    ) {
        return;
    }

    if (form.dataset.submitting === "true") {
        event.preventDefault();
        return;
    }

    form.dataset.submitting = "true";
    form.setAttribute("aria-busy", "true");

    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;

    submitter.disabled = true;
    const pendingLabel = submitter.dataset.pendingLabel;
    if (pendingLabel) submitter.textContent = pendingLabel;
});

function setRegionPending(region: HTMLElement, pending: boolean) {
    region.setAttribute("aria-busy", String(pending));

    const selector = region.dataset.pendingNavigation;
    if (!selector) return;
    for (const link of document.querySelectorAll<HTMLAnchorElement>(selector)) {
        if (pending) {
            link.setAttribute("aria-disabled", "true");
            link.setAttribute("data-pending-navigation-disabled", "");
        } else {
            link.removeAttribute("aria-disabled");
            link.removeAttribute("data-pending-navigation-disabled");
        }
    }
}

function htmxContext(event: Event) {
    return (event as CustomEvent<{ ctx?: HtmxRequestContext }>).detail?.ctx;
}
