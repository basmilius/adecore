import type { LucideIcon } from 'lucide-react';

/* A heading over part of the icons. The label arrives in the reader's language; the picker never translates it. */
export interface IconPickerGroup {
    id: string;
    label: string;
    icons: Readonly<Record<string, LucideIcon>>;
}

export type IconPickerIcons = Readonly<Record<string, LucideIcon>> | readonly IconPickerGroup[];

/* A flat set of icons is one section without a heading. */
export interface IconSection {
    id: string;
    label: string | null;
    icons: readonly (readonly [name: string, glyph: LucideIcon])[];
}

/* In the units of `getBoundingClientRect`. */
export interface IconCellBox {
    left: number;
    top: number;
    width: number;
}

export const isGrouped = (icons: IconPickerIcons): icons is readonly IconPickerGroup[] => Array.isArray(icons);

export const sectionsOf = (icons: IconPickerIcons): IconSection[] =>
    isGrouped(icons)
        ? icons.map((group) => ({ id: group.id, label: group.label, icons: Object.entries(group.icons) }))
        : [{ id: '', label: null, icons: Object.entries(icons) }];

/* The icons whose name, keywords or group label hold the query, case-insensitive. A group without one is left out. */
export const filterSections = (sections: readonly IconSection[], query: string, keywords: Readonly<Record<string, readonly string[]>> = {}): IconSection[] => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
        return [...sections];
    }
    const holds = (text: string): boolean => text.toLowerCase().includes(needle);
    return sections.flatMap((section) => {
        if (section.label !== null && holds(section.label)) {
            return [section];
        }
        const icons = section.icons.filter(([name]) => holds(name) || (keywords[name] ?? []).some(holds));
        return icons.length > 0 ? [{ ...section, icons }] : [];
    });
};

/* The one last focused, else the chosen one, else the first, as long as the search shows it. */
export const tabStopOf = (visible: readonly string[], focused: string | null, value: string | null): string | null =>
    [focused, value].find((name) => name !== null && visible.includes(name)) ?? visible[0] ?? null;

/* Rows lie a few pixels apart at least, so a rounding difference between two cells of one row is no new row. */
const SAME_ROW = 2;

/*
 * Null for a key the grid leaves alone. Up and down go to the nearest cell in the next row drawn, which
 * may belong to another group. At an edge the focus stays, so the key never scrolls the grid instead.
 */
export const cellForKey = (key: string, boxes: readonly IconCellBox[], from: number): number | null => {
    const last = boxes.length - 1;
    switch (key) {
        case 'ArrowRight':
            return Math.min(from + 1, last);
        case 'ArrowLeft':
            return Math.max(from - 1, 0);
        case 'Home':
            return 0;
        case 'End':
            return last;
        case 'ArrowDown':
        case 'ArrowUp':
            break;
        default:
            return null;
    }
    const current = boxes[from];
    if (current === undefined) {
        return null;
    }
    const down = key === 'ArrowDown';
    const tops = boxes.map((box) => box.top).filter((top) => (down ? top > current.top + SAME_ROW : top < current.top - SAME_ROW));
    if (tops.length === 0) {
        return from;
    }
    const row = down ? Math.min(...tops) : Math.max(...tops);
    const center = current.left + current.width / 2;
    let nearest = from;
    let distance = Number.POSITIVE_INFINITY;
    boxes.forEach((box, index) => {
        if (Math.abs(box.top - row) > SAME_ROW) {
            return;
        }
        const gap = Math.abs(box.left + box.width / 2 - center);
        if (gap < distance) {
            nearest = index;
            distance = gap;
        }
    });
    return nearest;
};

/* On an empty search Escape is left to whatever else hears it, such as a dialog. */
export const escapeClearsSearch = (key: string, query: string): boolean => key === 'Escape' && query !== '';
