import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import * as Menu from './menu/index.parts.ts';
import { SplitButton } from './SplitButton.tsx';

describe('a split button in use', () => {
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
