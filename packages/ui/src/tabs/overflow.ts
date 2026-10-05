/*
 * The tabs a strip shows, by index, given the width of every tab, the room the strip has, the gap
 * between two tabs and the width of the button that opens the rest. Everything fits, or the tabs fit
 * from the start up to the button. The picked tab is never left to the menu: it takes the place of
 * the last ones that no longer fit beside it.
 */
export const shownTabs = (widths: readonly number[], room: number, gap: number, more: number, picked: number): number[] => {
    const span = (indices: readonly number[]): number => indices.reduce((sum, index) => sum + widths[index]!, 0) + gap * Math.max(0, indices.length - 1);
    const all = widths.map((_, index) => index);
    // Half a pixel of slack, since a measured width is fractional and the room is not.
    if (span(all) <= room + 0.5) {
        return all;
    }
    const limit = room - more - gap + 0.5;
    const shown: number[] = [];
    for (const index of all) {
        if (span([...shown, index]) > limit) {
            break;
        }
        shown.push(index);
    }
    if (picked < 0 || picked >= widths.length || shown.includes(picked)) {
        return shown;
    }
    while (shown.length > 0 && span([...shown, picked]) > limit) {
        shown.pop();
    }
    return [...shown, picked];
};
