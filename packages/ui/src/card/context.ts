import { createContext, type RefObject } from 'react';

export interface CardContextValue {
    readonly titleId: string;
    readonly collapsible: boolean;
    readonly open: boolean;
    readonly section: RefObject<HTMLElement | null>;

    /* False when the caller names the card itself, so the header leaves `aria-labelledby` alone. */
    readonly labelledByTitle: boolean;
}

export const CardContext = createContext<CardContextValue | null>(null);

export type CardGridColumns = 1 | 2 | 3 | 4;
export type CardGridFlow = 'grid' | 'masonry';
export type CardSpan = number | 'full';

export interface CardGridPlace {
    readonly columns: CardGridColumns;
    readonly flow: CardGridFlow;
}

/* The grid a card stands in, so the card can set its own place without the grid reading its children. */
export const CardGridContext = createContext<CardGridPlace | null>(null);

/*
 * The `data-card-span` of a card: nothing for one column, a number of columns, or `full`. A span as wide as the grid is
 * the full row, and in masonry every span above one is, since a column there has no neighbor to join.
 */
export function cardSpan(span: CardSpan | undefined, grid: CardGridPlace | null): string | undefined {
    if (grid === null || span === undefined || span === 1) {
        return undefined;
    }

    if (span === 'full' || grid.flow === 'masonry' || span >= grid.columns) {
        return 'full';
    }

    const whole = Math.floor(span);

    return whole > 1 ? String(whole) : undefined;
}

/* The level of the next heading: a card's title, or a titled grid's, which makes the cards in it one level deeper. */
export const HeadingLevelContext = createContext(2);

const HEADINGS = ['h2', 'h3', 'h4', 'h5', 'h6'] as const;

export function headingTag(level: number): (typeof HEADINGS)[number] {
    return HEADINGS[Math.min(Math.max(level, 2), 6) - 2]!;
}
