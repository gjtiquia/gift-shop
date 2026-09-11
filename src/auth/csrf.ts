export function isValidCsrfRequest(request: Request) {
    if (request.method === "GET" || request.method === "HEAD") return true;

    const fetchSite = request.headers.get("Sec-Fetch-Site");
    if (fetchSite) return fetchSite === "same-origin";

    const origin = request.headers.get("Origin");
    if (!origin) return false;

    try {
        return new URL(origin).origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}
