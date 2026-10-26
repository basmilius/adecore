import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Menu from './menu/index.parts.ts';
import { SplitButton } from './SplitButton.tsx';

const classesOf = (markup: string): string[][] => [...markup.matchAll(/<button[^>]*class="([^"]+)"/g)].map((match) => match[1]!.split(' '));

describe('a split button', () => {
    test('draws one shape around both halves, with a short line between them', () => {
        const markup = renderToStaticMarkup(
            <SplitButton variant="primary" size="sm" menuLabel="More" menu={<Menu.Item>Commit and push</Menu.Item>}>
                Commit
            </SplitButton>
        );

        const frame = /<span class="([^"]+)"/.exec(markup)![1]!.split(' ');
        expect(frame).toEqual(expect.arrayContaining(['h-7', 'rounded-md', 'overflow-clip']));
        const [action, chevron] = classesOf(markup);
        expect(action).toEqual(expect.arrayContaining(['px-2.5', 'bg-accent']));
        expect(chevron).toEqual(expect.arrayContaining(['px-1.5', 'bg-accent', 'before:h-3.5', 'before:bg-current/30']));
        expect(action).not.toContain('before:w-px');
        expect(markup).toContain('Commit</button>');
        expect(markup).toContain('aria-label="More"');
        expect(markup).toContain('aria-haspopup="menu"');
        expect(markup).not.toContain('Commit and push');
    });

    test('draws the outline of an outlined variant once, on the shape', () => {
        const markup = renderToStaticMarkup(
            <SplitButton menuLabel="More" menu={null}>
                Push
            </SplitButton>
        );

        expect(/<span class="([^"]+)"/.exec(markup)![1]!.split(' ')).toEqual(expect.arrayContaining(['border', 'border-field-border']));

        for (const half of classesOf(markup)) {
            expect(half).not.toContain('border');
        }
    });

    test('disables each half on its own', () => {
        const actionOff = renderToStaticMarkup(
            <SplitButton disabled menuLabel="More" menu={null}>
                Push
            </SplitButton>
        );

        expect(actionOff).toMatch(/<button[^>]*disabled=""[^>]*>Push<\/button>/);
        expect(actionOff).not.toMatch(/aria-label="More"[^>]*disabled/);

        const menuOff = renderToStaticMarkup(
            <SplitButton menuDisabled menuLabel="More" menu={null}>
                Push
            </SplitButton>
        );

        expect(menuOff).not.toMatch(/disabled=""[^>]*>Push<\/button>/);
        expect(menuOff).toMatch(/<button[^>]*disabled=""[^>]*aria-label="More"|<button[^>]*aria-label="More"[^>]*disabled=""/);
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/SplitButton.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a split button in use', () => {
    let container: HTMLDivElement;
    let root: Root;

    const mount = async (node: ReactNode): Promise<void> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('runs the action from one half and opens the menu from the other', async () => {
        const ran: string[] = [];

        await mount(
            <SplitButton menuLabel="More" onClick={() => ran.push('commit')} menu={<Menu.Item onClick={() => ran.push('push')}>Commit and push</Menu.Item>}>
                Commit
            </SplitButton>
        );

        const [action, chevron] = [...container.querySelectorAll('button')];
        await act(async () => action!.click());
        expect(ran).toEqual(['commit']);
        expect(document.body.textContent).not.toContain('Commit and push');

        await act(async () => chevron!.click());
        expect(chevron!.getAttribute('aria-expanded')).toBe('true');
        const item = [...document.querySelectorAll('[role="menuitem"]')].find((element) => element.textContent === 'Commit and push') as HTMLElement;
        await act(async () => item.click());
        expect(ran).toEqual(['commit', 'push']);
    });
});
