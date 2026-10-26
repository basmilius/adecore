import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, useState, type ReactNode } from 'react';
import { List } from 'lucide-react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Segmented, type SegmentedProps } from './Segmented.tsx';
import { segmentedTarget } from './segmented-keys.ts';

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

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/Segmented.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a segmented control under the keyboard', () => {
    let container: HTMLDivElement;
    let changes: string[];
    let root: Root;

    function Harness(props: Partial<SegmentedProps<View>> & { initial: View }) {
        const { initial, ...rest } = props;
        const [value, setValue] = useState<View>(initial);

        return (
            <Segmented<View>
                label="View"
                options={OPTIONS}
                {...rest}
                value={value}
                onValueChange={(next) => {
                    changes.push(next);
                    setValue(next);
                }}
            />
        );
    }

    const mount = async (node: ReactNode): Promise<HTMLButtonElement[]> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));

        return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    };

    const press = async (key: string): Promise<void> => {
        await act(async () => {
            (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    const state = (radios: readonly HTMLButtonElement[]) => ({
        checked: radios.map((radio) => radio.getAttribute('aria-checked')),
        focus: radios.indexOf(document.activeElement as HTMLButtonElement),
        tabs: radios.map((radio) => radio.tabIndex)
    });

    beforeEach(() => {
        changes = [];
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('picks and focuses the next option with the arrows, around the ends, and the ends with Home and End', async () => {
        const radios = await mount(<Harness initial="list" />);
        radios[0]!.focus();
        await press('ArrowRight');
        expect(state(radios)).toEqual({ checked: ['false', 'true', 'false'], focus: 1, tabs: [-1, 0, -1] });
        await press('ArrowDown');
        await press('ArrowDown');
        expect(state(radios).focus).toBe(0);
        await press('ArrowLeft');
        await press('ArrowUp');
        await press('Home');
        await press('End');
        expect(changes).toEqual(['grid', 'split', 'list', 'split', 'grid', 'list', 'split']);
        expect(state(radios)).toEqual({ checked: ['false', 'false', 'true'], focus: 2, tabs: [-1, -1, 0] });
    });

    test('passes over a disabled option with the arrows, Home and End', async () => {
        const options = [{ ...OPTIONS[0], disabled: true }, OPTIONS[1], { ...OPTIONS[2], disabled: true }, { id: 'board' as View, label: 'Board' }];
        const radios = await mount(<Harness initial="grid" options={options} />);
        radios[1]!.focus();
        await press('ArrowRight');
        expect(state(radios).focus).toBe(3);
        await press('ArrowRight');
        await press('ArrowLeft');
        await press('Home');
        await press('End');
        expect(changes).toEqual(['board', 'grid', 'board', 'grid', 'board']);
        expect(state(radios)).toEqual({ checked: ['false', 'false', 'false', 'true'], focus: 3, tabs: [-1, -1, -1, 0] });
    });

    test('leaves other keys and a disabled group alone', async () => {
        const radios = await mount(<Harness initial="grid" disabled />);
        radios[1]!.focus();
        await press('ArrowRight');
        await press('a');
        expect(changes).toEqual([]);
        expect(radios.every((radio) => radio.disabled)).toBe(true);
    });
});
