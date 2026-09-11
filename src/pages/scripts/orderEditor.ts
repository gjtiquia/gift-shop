for (const section of document.querySelectorAll<HTMLElement>(
    "[data-js-orderEditor]",
)) {
    setupOrderEditor(section);
}

function setupOrderEditor(section: HTMLElement) {
    const formCandidate = section.querySelector<HTMLFormElement>(
        "[data-js-orderEditForm]",
    );
    const editCandidate = section.querySelector<HTMLButtonElement>(
        "[data-js-orderEdit]",
    );
    const saveCandidate = section.querySelector<HTMLButtonElement>(
        "[data-js-orderSave]",
    );
    const discardCandidate = section.querySelector<HTMLButtonElement>(
        "[data-js-orderDiscard]",
    );
    if (!formCandidate || !editCandidate || !saveCandidate || !discardCandidate)
        return;
    const form = formCandidate;
    const edit = editCandidate;
    const save = saveCandidate;
    const discard = discardCandidate;

    edit.addEventListener("click", () => setEditMode(true));
    discard.addEventListener("click", () => {
        form.reset();
        setEditMode(false);
    });

    function setEditMode(enabled: boolean) {
        for (const field of section.querySelectorAll<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("[data-js-orderField]")) {
            field.disabled = !enabled;
        }
        for (const element of section.querySelectorAll<HTMLElement>(
            "[data-js-orderEditOnly]",
        )) {
            element.hidden = !enabled;
        }
        for (const element of section.querySelectorAll<HTMLElement>(
            "[data-js-orderReadOnly]",
        )) {
            element.hidden = enabled;
        }
        edit.hidden = enabled;
        save.hidden = !enabled;
        discard.hidden = !enabled;
    }
}
