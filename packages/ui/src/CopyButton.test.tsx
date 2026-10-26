import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyButton } from './CopyButton.tsx';

describe('a copy button', () => {
    test('is an icon named after what it copies, or a button with the word', () => {
        expect(renderToStaticMarkup(<CopyButton text="dsn" />)).toContain('aria-label="Copy"');
        expect(renderToStaticMarkup(<CopyButton text="dsn" label="Copy DSN" />)).toContain('aria-label="Copy DSN"');
        const labeled = renderToStaticMarkup(<CopyButton text="output" label="Copy output" showLabel />);
        expect(labeled).not.toContain('aria-label');
        expect(labeled).toContain('Copy output</button>');
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/CopyButton.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a copy button under a click', () => {
    let container: HTMLDivElement;
    let root: Root;
    let written: string[];
    let refuse: boolean;

    const mount = async (node: ReactNode): Promise<HTMLButtonElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));

        return container.querySelector('button')!;
    };

    const status = (): string => container.querySelector('[role="status"]')!.textContent ?? '';

    beforeEach(() => {
        written = [];
        refuse = false;

        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    if (refuse) {
                        throw new Error('refused');
                    }

                    written.push(text);
                }
            }
        });

        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        jest.useRealTimers();
    });

    test('copies the text and says so, in the word and to a screen reader', async () => {
        const button = await mount(<CopyButton text="npm install" label="Copy command" showLabel />);
        expect(status()).toBe('');
        await act(async () => button.click());
        expect(written).toEqual(['npm install']);
        expect(button.textContent).toBe('Copied');
        expect(status()).toBe('Copied');
    });

    test('goes back to its name a moment later, and a second copy starts that moment again', async () => {
        jest.useFakeTimers();
        const button = await mount(<CopyButton text="npm install" label="Copy command" showLabel />);
        await act(async () => button.click());
        await act(async () => jest.advanceTimersByTime(1000));
        await act(async () => button.click());
        await act(async () => jest.advanceTimersByTime(1000));
        expect(button.textContent).toBe('Copied');

        await act(async () => jest.advanceTimersByTime(500));
        expect(button.textContent).toBe('Copy command');
        expect(status()).toBe('');
    });

    test('says a second copy to a screen reader again', async () => {
        jest.useFakeTimers();
        const button = await mount(<CopyButton text="token" label="Copy token" />);
        await act(async () => button.click());
        const first = container.querySelector('[role="status"] > *');
        await act(async () => jest.advanceTimersByTime(500));
        await act(async () => button.click());
        const second = container.querySelector('[role="status"] > *');
        expect(second?.textContent).toBe('Copied');
        expect(second).not.toBe(first);
    });

    test('leaves no timer behind once it is gone', async () => {
        const started = spyOn(window, 'setTimeout');
        const cleared = spyOn(window, 'clearTimeout');
        const button = await mount(<CopyButton text="token" label="Copy token" />);
        await act(async () => button.click());
        const timer = started.mock.results.at(-1)?.value;
        await act(async () => root.unmount());
        expect(cleared).toHaveBeenCalledWith(timer);
        started.mockRestore();
        cleared.mockRestore();
    });

    test('keeps its name and confirms nothing when the browser refuses', async () => {
        refuse = true;
        const button = await mount(<CopyButton text="token" label="Copy token" />);
        await act(async () => button.click());
        expect(button.getAttribute('aria-label')).toBe('Copy token');
        expect(status()).toBe('');
    });
});
