import { describe, expect, test } from 'bun:test';
import { Bug, Cloud, Database, GitBranch, Rocket, Server } from 'lucide-react';
import { cellForKey, escapeClearsSearch, filterSections, sectionsOf, tabStopOf, type IconCellBox, type IconPickerGroup } from './icon-picker.ts';

const GROUPS: IconPickerGroup[] = [
    { id: 'code', label: 'Code', icons: { 'git-branch': GitBranch, bug: Bug } },
    { id: 'infra', label: 'Infrastructure', icons: { server: Server, cloud: Cloud, database: Database } }
];

const namesOf = (sections: ReturnType<typeof sectionsOf>): string[][] => sections.map((section) => section.icons.map(([name]) => name));

/* Cells of 28 with a gap of 4, `columns` to a row, and a group's heading of 28 above each group. */
const layout = (groups: number[], columns: number): IconCellBox[] => {
    const boxes: IconCellBox[] = [];
    let top = 0;
    for (const count of groups) {
        top += 28;
        for (let i = 0; i < count; i++) {
            boxes.push({ left: (i % columns) * 32, top: top + Math.floor(i / columns) * 32, width: 28 });
        }
        top += Math.ceil(count / columns) * 32 + 4;
    }
    return boxes;
};

describe('the sections of an icon picker', () => {
    test('are one section without a heading for a flat set, in the order it was given', () => {
        const sections = sectionsOf({ rocket: Rocket, bug: Bug });
        expect(sections.map((section) => section.label)).toEqual([null]);
        expect(namesOf(sections)).toEqual([['rocket', 'bug']]);
    });

    test('are the groups with their labels', () => {
        expect(sectionsOf(GROUPS).map((section) => section.label)).toEqual(['Code', 'Infrastructure']);
    });
});

describe('a search in an icon picker', () => {
    const sections = sectionsOf(GROUPS);

    test('shows everything while it is empty or blank', () => {
        expect(namesOf(filterSections(sections, ''))).toEqual(namesOf(sections));
        expect(namesOf(filterSections(sections, '   '))).toEqual(namesOf(sections));
    });

    test('finds an icon by a part of its name, whatever the case, and leaves out a group without a match', () => {
        const found = filterSections(sections, 'BRAN');
        expect(found.map((section) => section.label)).toEqual(['Code']);
        expect(namesOf(found)).toEqual([['git-branch']]);
    });

    test('finds an icon by one of its keywords', () => {
        expect(namesOf(filterSections(sections, 'postgres', { database: ['sql', 'Postgres'] }))).toEqual([['database']]);
    });

    test('shows a whole group when its label matches', () => {
        expect(namesOf(filterSections(sections, 'infra'))).toEqual([['server', 'cloud', 'database']]);
    });

    test('keeps the heading of every group that still has a match', () => {
        expect(filterSections(sections, 'u').map((section) => section.label)).toEqual(['Code', 'Infrastructure']);
    });

    test('is empty when nothing matches', () => {
        expect(filterSections(sections, 'xyz')).toEqual([]);
    });

    test('clears on Escape only while it holds text, and leaves Escape to a dialog otherwise', () => {
        expect(escapeClearsSearch('Escape', 'git')).toBe(true);
        expect(escapeClearsSearch('Escape', '')).toBe(false);
        expect(escapeClearsSearch('Enter', 'git')).toBe(false);
    });
});

describe('the tab stop of an icon picker', () => {
    const visible = ['bug', 'rocket', 'cloud'];

    test('is the chosen icon, and the first one without a choice', () => {
        expect(tabStopOf(visible, null, 'rocket')).toBe('rocket');
        expect(tabStopOf(visible, null, null)).toBe('bug');
    });

    test('follows the focus once it moved', () => {
        expect(tabStopOf(visible, 'cloud', 'rocket')).toBe('cloud');
    });

    test('falls back to the first icon the search shows when the choice is hidden', () => {
        expect(tabStopOf(['cloud'], 'bug', 'rocket')).toBe('cloud');
        expect(tabStopOf([], null, 'rocket')).toBeNull();
    });
});

describe('the keys in the grid of an icon picker', () => {
    // A group of 6 and a group of 3, 4 to a row: rows of 4 and 2, then a row of 3.
    const boxes = layout([6, 3], 4);

    test('move left and right one icon, across a group, and stay at either end', () => {
        expect(cellForKey('ArrowRight', boxes, 5)).toBe(6);
        expect(cellForKey('ArrowLeft', boxes, 6)).toBe(5);
        expect(cellForKey('ArrowLeft', boxes, 0)).toBe(0);
        expect(cellForKey('ArrowRight', boxes, 8)).toBe(8);
    });

    test('move up and down to the nearest icon of the next row drawn, across a group', () => {
        expect(cellForKey('ArrowDown', boxes, 1)).toBe(5);
        expect(cellForKey('ArrowDown', boxes, 3)).toBe(5);
        expect(cellForKey('ArrowDown', boxes, 5)).toBe(7);
        expect(cellForKey('ArrowUp', boxes, 8)).toBe(5);
        expect(cellForKey('ArrowUp', boxes, 6)).toBe(4);
        expect(cellForKey('ArrowUp', boxes, 2)).toBe(2);
        expect(cellForKey('ArrowDown', boxes, 7)).toBe(7);
    });

    test('go to the first and the last icon on Home and End', () => {
        expect(cellForKey('Home', boxes, 7)).toBe(0);
        expect(cellForKey('End', boxes, 1)).toBe(8);
    });

    test('leave Enter, Space and every other key to the button, whose click is the one way to choose', () => {
        expect(cellForKey('Enter', boxes, 3)).toBeNull();
        expect(cellForKey(' ', boxes, 3)).toBeNull();
        expect(cellForKey('a', boxes, 3)).toBeNull();
    });
});
