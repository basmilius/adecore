import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, useState, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { Segmented, type SegmentedProps } from './Segmented.tsx';

const OPTIONS = [
    { id: 'list', label: 'List' },
    { id: 'grid', label: 'Grid' },
    { id: 'split', label: 'Split' }
] as const;

type View = (typeof OPTIONS)[number]['id'];

describe('a segmented control under the keyboard', () => {
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
