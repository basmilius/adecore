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

/* The level of the next heading: a card's title, or a titled grid's, which makes the cards in it one level deeper. */
export const HeadingLevelContext = createContext(2);

const HEADINGS = ['h2', 'h3', 'h4', 'h5', 'h6'] as const;

export function headingTag(level: number): (typeof HEADINGS)[number] {
    return HEADINGS[Math.min(Math.max(level, 2), 6) - 2]!;
}
