export function isValidCsrfRequest(request: Request) {
    if (request.method === "GET" || request.method === "HEAD") return true;

    return request.headers.get("Sec-Fetch-Site") === "same-origin";
}
