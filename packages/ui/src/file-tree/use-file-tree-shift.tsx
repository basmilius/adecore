import { useMemo, type ReactElement } from 'react';
import type { FileTree } from '@pierre/trees';
import { useTreeShift, type TreeShiftSource } from '../tree/use-tree-shift.tsx';
import { shiftNeed } from './shift.ts';

const ROWS = '[data-type="item"]:not([data-item-parked="true"])';

function boxesOf(element: Element): Element[] {
    return element.getClientRects().length > 0 ? [element] : [...element.children].flatMap((child) => boxesOf(child));
}

function limitOf(row: HTMLElement, content: Element, gap: number): number {
    const start = content.getBoundingClientRect().left;
    let limit = Number.POSITIVE_INFINITY;
    for (const part of [...row.children].filter((child) => child !== content).flatMap((child) => boxesOf(child))) {
        const rect = part.getBoundingClientRect();
        if (rect.width === 0 || rect.left < start) {
            continue;
        }
        if (part.childNodes.length === 0 && Number.parseFloat(getComputedStyle(part).flexGrow) > 0) {
            continue;
        }
        limit = Math.min(limit, rect.left - gap);
    }
    if (limit !== Number.POSITIVE_INFINITY) {
        return limit - (Number.parseFloat(getComputedStyle(content).marginInlineEnd) || 0);
    }
    return (
        row.getBoundingClientRect().right -
        Number.parseFloat(getComputedStyle(row).paddingInlineEnd) -
        (Number.parseFloat(getComputedStyle(content).marginInlineEnd) || 0)
    );
}

function needOf(row: HTMLElement, shift: number, gap: number, range: Range): number | null {
    const content = row.querySelector(':scope > [data-item-section="content"]');
    if (content === null || row.getBoundingClientRect().width === 0) {
        return null;
    }
    range.selectNodeContents(content);
    return shiftNeed(range.getBoundingClientRect().right, limitOf(row, content, gap), shift);
}

/* The file tree draws its rows in a shadow root, and only the name slides: its decorations sit over the row. */
export function useFileTreeShift(model: FileTree, resetKey?: string): { attach(node: HTMLElement | null): void; bar: ReactElement } {
    const source = useMemo(
        (): TreeShiftSource => ({
            root: () => model.getFileTreeContainer()?.shadowRoot ?? null,
            rows: (root) => [...root.querySelectorAll<HTMLElement>(ROWS)],
            need: needOf
        }),
        [model]
    );
    return useTreeShift(source, resetKey);
}
