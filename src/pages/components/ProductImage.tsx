import { html, Html } from "@elysia/html";

export function ProductImage({
    imageId,
    name,
    class: className = "size-16 rounded-md bg-gray-100 object-cover",
}: {
    imageId: number | null;
    name: string;
    class?: string;
}) {
    return imageId !== null ? (
        <img
            class={className}
            src={`/api/images/${imageId}`}
            width="96"
            height="96"
            loading="lazy"
            decoding="async"
            alt={`Photo of ${name}`}
        />
    ) : (
        <div
            class={`flex items-center justify-center bg-gray-100 px-2 text-center text-xs text-gray-500 ${className}`}
            role="img"
            aria-label={`No image available for ${name}`}
        >
            No image available
        </div>
    );
}
