for (const element of document.querySelectorAll<HTMLElement>(
    "[data-js-nativeAlert]",
)) {
    window.alert(
        element.textContent?.trim() || "The request could not be completed.",
    );
}
