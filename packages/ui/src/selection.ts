/* A menu belongs to the surface the click landed on, so both of these are scoped to an element: a selection elsewhere is none this menu can copy. */

export const selectionWithin = (element: HTMLElement | null): string => {
    const selection = window.getSelection();
    if (!element || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        return '';
    }
    return element.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.toString() : '';
};

export const selectAllWithin = (element: HTMLElement | null): void => {
    const selection = window.getSelection();
    if (!element || !selection) {
        return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
};
