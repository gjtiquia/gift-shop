export interface PartialRefreshToken {
    generation: number;
    revision: string;
}

interface HtmxInitializable extends EventTarget {
    hasAttribute(name: string): boolean;
}

export function whenHtmxInitialized(
    element: HtmxInitializable,
    operation: () => void,
) {
    if (element.hasAttribute("data-htmx-powered")) {
        operation();
        return;
    }

    const handleInit = (event: Event) => {
        if (event.target !== element) return;
        element.removeEventListener("htmx:after:init", handleInit);
        operation();
    };
    element.addEventListener("htmx:after:init", handleInit);
}

export class PartialRefreshState {
    private generation = 0;

    begin(revision: string): PartialRefreshToken {
        return { generation: ++this.generation, revision };
    }

    isCurrent(token: PartialRefreshToken, currentRevision: string) {
        return (
            token.generation === this.generation &&
            token.revision === currentRevision
        );
    }
}

interface HtmxRequestContext {
    response?: { status?: number };
    sourceEvent?: Event;
}

export function htmxContext(event: Event) {
    return (event as CustomEvent<{ ctx?: HtmxRequestContext }>).detail?.ctx;
}

export function refreshToken(event: Event | undefined) {
    const detail = (
        event as CustomEvent<Partial<PartialRefreshToken>> | undefined
    )?.detail;
    if (
        !detail ||
        !Number.isSafeInteger(detail.generation) ||
        typeof detail.revision !== "string"
    ) {
        return null;
    }
    return {
        generation: Number(detail.generation),
        revision: detail.revision,
    };
}

export function isSuccessfulHtmxResponse(
    context: HtmxRequestContext | undefined,
) {
    return (context?.response?.status ?? 500) < 400;
}
