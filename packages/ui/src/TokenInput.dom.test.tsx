import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { TokenInput, type TokenInputToken } from './TokenInput.tsx';

const TOKENS: TokenInputToken[] = [
    { key: 'sanne@example.com', label: 'Sanne de Vries' },
    { key: 'jan@example.com', label: 'Jan Dekker' }
];

describe('a token input', () => {
    let container: HTMLDivElement;
    let root: Root;
    let commits: string[];
    let removed: string[];

    const mount = async (value: string, tokens = TOKENS): Promise<HTMLInputElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);

        await act(async () =>
            root.render(
                <TokenInput
                    label="To"
                    tokens={tokens}
                    value={value}
                    onValueChange={() => {}}
                    onCommit={(text) => commits.push(text)}
                    onRemove={(key) => removed.push(key)}
                />
            )
        );

        return container.querySelector('input')!;
    };

    const press = async (input: HTMLInputElement, key: string): Promise<boolean> => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        await act(async () => input.dispatchEvent(event));

        return event.defaultPrevented;
    };

    beforeEach(() => {
        commits = [];
        removed = [];
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('hands over its text on Enter, a comma and a semicolon, and keeps the key out of the text', async () => {
        const input = await mount('kim@example.com');

        for (const key of ['Enter', ',', ';']) {
            expect(await press(input, key)).toBe(true);
        }

        expect(commits).toEqual(['kim@example.com', 'kim@example.com', 'kim@example.com']);
    });

    test('hands over nothing while the text is empty', async () => {
        const input = await mount('  ');
        await press(input, 'Enter');
        expect(commits).toEqual([]);
    });

    test('removes the last token on Backspace in an empty field, and only then', async () => {
        const empty = await mount('');
        await press(empty, 'Backspace');
        expect(removed).toEqual(['jan@example.com']);

        await act(async () => root.unmount());
        const typed = await mount('ki');
        expect(await press(typed, 'Backspace')).toBe(false);
        expect(removed).toEqual(['jan@example.com']);
    });

    test('names each remove button after its token, and removes that token', async () => {
        await mount('');
        const buttons = [...container.querySelectorAll('button')];
        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Remove Sanne de Vries', 'Remove Jan Dekker']);

        await act(async () => buttons[0]!.click());
        expect(removed).toEqual(['sanne@example.com']);
    });
});
