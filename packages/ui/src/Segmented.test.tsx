import { describe, expect, test } from 'bun:test';
import { List } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { segmentedTarget } from './segmented-keys.ts';
import { Segmented } from './Segmented.tsx';

const OPTIONS = [
    { id: 'list', label: 'List' },
    { id: 'grid', label: 'Grid' },
    { id: 'split', label: 'Split' }
] as const;

type View = (typeof OPTIONS)[number]['id'];

describe('a segmented control', () => {
    test('is one tab stop: the picked option, or the first when none is picked', () => {
        const picked = renderToStaticMarkup(<Segmented label="View" value="grid" onValueChange={() => {}} options={OPTIONS} />);
        expect([...picked.matchAll(/tabindex="(-?\d)"/g)].map((match) => match[1])).toEqual(['-1', '0', '-1']);
        const none = renderToStaticMarkup(<Segmented label="View" value={'other' as View} onValueChange={() => {}} options={OPTIONS} />);
        expect([...none.matchAll(/tabindex="(-?\d)"/g)].map((match) => match[1])).toEqual(['0', '-1', '-1']);
    });

    test('never puts the tab stop on a disabled option, also when that option is picked', () => {
        const options = [{ ...OPTIONS[0], disabled: true }, OPTIONS[1], OPTIONS[2]];
        const markup = renderToStaticMarkup(<Segmented label="View" value="list" onValueChange={() => {}} options={options} />);
        expect([...markup.matchAll(/tabindex="(-?\d)"/g)].map((match) => match[1])).toEqual(['-1', '0', '-1']);
        expect(markup).toMatch(/aria-checked="true"[^>]*disabled=""/);
    });

    test('names an icon-only option by its label instead of drawing it', () => {
        const options = OPTIONS.map((option) => ({ ...option, icon: List }));
        const markup = renderToStaticMarkup(<Segmented label="View" value="list" onValueChange={() => {}} options={options} iconOnly />);
        expect([...markup.matchAll(/aria-label="(\w+)"/g)].map((match) => match[1])).toEqual(['View', 'List', 'Grid', 'Split']);
        expect(markup).not.toMatch(/>(List|Grid|Split)</);
    });

    test('keeps the label of an icon-only option that has no icon', () => {
        const options = [{ ...OPTIONS[0], icon: List }, OPTIONS[1]];
        const markup = renderToStaticMarkup(<Segmented label="View" value="list" onValueChange={() => {}} options={options} iconOnly />);
        expect(markup).not.toMatch(/>List</);
        expect(markup).toMatch(/>Grid<\/button>/);
    });

    test('takes a state setter as it is, typed by its value rather than widened to a string', () => {
        let view: View = 'list';
        const setView: Dispatch<SetStateAction<View>> = (next) => {
            view = typeof next === 'function' ? next(view) : next;
        };

        const markup = renderToStaticMarkup(<Segmented label="View" value={view} onValueChange={setView} options={OPTIONS} />);
        expect(markup).toMatch(/aria-checked="true"[^>]*>List</);
    });

    test('draws only the picked option with its label when unpicked ones are icons', () => {
        const options = OPTIONS.map((option) => ({ ...option, icon: List }));
        const markup = renderToStaticMarkup(<Segmented label="View" value="grid" onValueChange={() => {}} options={options} iconOnly="unpicked" />);
        expect(markup).toMatch(/aria-label="List"/);
        expect(markup).toMatch(/aria-label="Split"/);
        expect(markup).not.toMatch(/aria-label="Grid"/);
        expect(markup).toMatch(/<\/svg>Grid<\/button>/);
    });

    test('marks an option with a dot, and reads out what the dot means', () => {
        const options = [
            { ...OPTIONS[0], icon: List, indicator: true, indicatorLabel: '3 unread' },
            { ...OPTIONS[1], indicator: true, indicatorLabel: '1 unread' },
            OPTIONS[2]
        ];
        const markup = renderToStaticMarkup(<Segmented label="View" value="grid" onValueChange={() => {}} options={options} iconOnly="unpicked" />);
        expect(markup).toContain('aria-label="List, 3 unread"');
        expect(markup).toContain('<span class="sr-only">, 1 unread</span>');
        expect([...markup.matchAll(/rounded-full bg-text-muted/g)]).toHaveLength(2);
    });

    test('moves past a disabled option with the arrows, Home and End, and around the ends', () => {
        const options = [{ ...OPTIONS[0], disabled: true }, OPTIONS[1], { ...OPTIONS[2], disabled: true }, { id: 'board', label: 'Board' }];
        expect(segmentedTarget(options, 1, 'ArrowRight')).toBe(3);
        expect(segmentedTarget(options, 3, 'ArrowDown')).toBe(1);
        expect(segmentedTarget(options, 1, 'ArrowLeft')).toBe(3);
        expect(segmentedTarget(options, 3, 'ArrowUp')).toBe(1);
        expect(segmentedTarget(options, 3, 'Home')).toBe(1);
        expect(segmentedTarget(options, 1, 'End')).toBe(3);
        expect(segmentedTarget(options, 1, 'a')).toBeNull();

        expect(
            segmentedTarget(
                OPTIONS.map((option) => ({ ...option, disabled: true })),
                0,
                'ArrowRight'
            )
        ).toBeNull();
    });

    test('grows with a label that wraps instead of holding a fixed height, and can stand as a column', () => {
        const markup = renderToStaticMarkup(<Segmented label="View" value="list" onValueChange={() => {}} options={OPTIONS} />);
        expect(markup).not.toMatch(/(?<![\w-])h-[78]\b/);
        const column = renderToStaticMarkup(<Segmented label="View" value="list" onValueChange={() => {}} options={OPTIONS} orientation="vertical" />);
        expect(column).toContain('aria-orientation="vertical"');
        expect(column).toContain('flex-col');
    });
});
