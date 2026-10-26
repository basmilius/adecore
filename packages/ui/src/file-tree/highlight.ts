/* The name a tree's shadow stylesheet colors with `::highlight()`. One registry entry is shared by every tree on the page. */
export const MATCH_HIGHLIGHT = 'adecore-tree-match';

// The copies of a name the engine keeps for truncation, which the tree's stylesheet hides.
const HIDDEN_PARTS = '[data-truncate-content="overflow"], [data-truncate-marker-cell], [data-truncate-fill]';

let shared: Highlight | null = null;

/* Null where the browser has no CSS Custom Highlight API; the names are then drawn without a mark. */
export function matchHighlight(): Highlight | null {
    if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof Highlight === 'undefined') {
        return null;
    }

    if (shared === null) {
        shared = new Highlight();
    }

    if (CSS.highlights.get(MATCH_HIGHLIGHT) !== shared) {
        CSS.highlights.set(MATCH_HIGHLIGHT, shared);
    }

    return shared;
}

/* Every place `query` occurs in `text`, ignoring case, as `[start, end)` pairs that do not overlap. */
export function matchRanges(text: string, query: string): [number, number][] {
    const wanted = query.toLowerCase();
    const haystack = text.toLowerCase();

    // A letter that lowercases to more than one would shift every offset after it.
    if (wanted === '' || haystack.length !== text.length) {
        return [];
    }

    const found: [number, number][] = [];
    let at = haystack.indexOf(wanted);

    while (at !== -1) {
        found.push([at, at + wanted.length]);
        at = haystack.indexOf(wanted, at + wanted.length);
    }

    return found;
}

/* The ranges over the visible text of each row's name where `query` occurs. */
export function rangesOfMatches(rows: readonly HTMLElement[], query: string): Range[] {
    const ranges: Range[] = [];

    if (query === '') {
        return ranges;
    }

    for (const row of rows) {
        const content = row.querySelector('[data-item-section="content"]');

        if (content === null) {
            continue;
        }

        const nodes: Text[] = [];
        const walker = row.ownerDocument.createTreeWalker(content, NodeFilter.SHOW_TEXT);

        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            if (node.parentElement?.closest(HIDDEN_PARTS) === null) {
                nodes.push(node as Text);
            }
        }

        const starts: number[] = [];
        let text = '';

        for (const node of nodes) {
            starts.push(text.length);
            text += node.data;
        }

        // The node an offset falls in, and the offset inside it; an end may sit at the end of a node.
        const locate = (offset: number, end: boolean): [Text, number] => {
            let index = nodes.length - 1;

            while (index > 0 && (end ? starts[index]! >= offset : starts[index]! > offset)) {
                index--;
            }

            return [nodes[index]!, offset - starts[index]!];
        };

        for (const [start, end] of matchRanges(text, query)) {
            const range = row.ownerDocument.createRange();
            range.setStart(...locate(start, false));
            range.setEnd(...locate(end, true));
            ranges.push(range);
        }
    }

    return ranges;
}
