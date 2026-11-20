import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { CardBody, CardHeader, CardRoot } from './parts.tsx';

describe('a card in the page', () => {
    let container: HTMLDivElement;
    let root: Root;

    const mount = async (node: ReactNode): Promise<HTMLElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));

        return container.querySelector('section')!;
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('takes its name from its title', async () => {
        const section = await mount(
            <CardRoot>
                <CardHeader title="Device" />
            </CardRoot>
        );
        const heading = section.querySelector('h2')!;
        expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    });

    test('has no name without a title, and keeps one the caller gives', async () => {
        const untitled = await mount(
            <CardRoot>
                <CardBody>Facts</CardBody>
            </CardRoot>
        );
        expect(untitled.hasAttribute('aria-labelledby')).toBe(false);

        await act(async () =>
            root.render(
                <CardRoot aria-label="Facts">
                    <CardHeader title="Device" />
                </CardRoot>
            )
        );
        expect(container.querySelector('section')!.hasAttribute('aria-labelledby')).toBe(false);
    });

    test('folds its body and actions away behind the toggle, which names the card', async () => {
        const changes: boolean[] = [];
        const section = await mount(
            <CardRoot collapsible onOpenChange={(open) => changes.push(open)}>
                <CardHeader title="Extra keys">
                    <span>Action</span>
                </CardHeader>
                <CardBody>Keys</CardBody>
            </CardRoot>
        );
        const toggle = section.querySelector('button')!;
        const labels = toggle.getAttribute('aria-labelledby')!.split(' ');
        expect(labels).toEqual([toggle.id, section.querySelector('h2')!.id]);
        expect(toggle.getAttribute('aria-label')).toBe('Collapse');
        expect(section.textContent).toContain('Keys');

        await act(async () => toggle.click());
        expect(changes).toEqual([false]);
        expect(section.textContent).not.toContain('Keys');
        expect(section.textContent).not.toContain('Action');
        expect(section.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
    });

    test('follows the open state its caller holds', async () => {
        const section = await mount(
            <CardRoot collapsible open={false}>
                <CardHeader title="Extra keys" />
                <CardBody>Keys</CardBody>
            </CardRoot>
        );

        await act(async () => section.querySelector('button')!.click());
        expect(section.textContent).not.toContain('Keys');
    });
});
