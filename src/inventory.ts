export function parsePrice(price: string) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
    if (!match) return null;

    const whole = BigInt(match[1]);
    const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
    const priceCentsX10 = whole * 100n + fraction;
    if (priceCentsX10 > BigInt(Number.MAX_SAFE_INTEGER)) return null;

    return Number(priceCentsX10);
}

export function formatPrice(priceCentsX10: number) {
    const whole = Math.floor(priceCentsX10 / 100);
    const fraction = String(priceCentsX10 % 100).padStart(2, "0");
    return `${whole}.${fraction}`;
}
