import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Table from './index.parts.ts';
import type { TableColumnLayout } from './parts.tsx';

const COLUMNS: TableColumnLayout[] = [{ width: 'minmax(0,2fr)' }, { width: 'auto', align: 'end', hideBelow: 'md' }, { width: '120px', hideBelow: 'sm' }];

const tagOf = (markup: string, pattern: RegExp): string => {
    const tag = markup.match(new RegExp(`<div[^>]*${pattern.source}[^>]*>`))?.[0];

    if (tag === undefined) {
        throw new Error(`No element matches ${pattern}`);
    }

    return tag;
};

const classesOf = (tag: string): string[] => /class="([^"]*)"/.exec(tag)?.[1]?.split(' ') ?? [];

describe('a table', () => {
    test('names itself and gives every part its role, with aria-sort only on a sortable column', () => {
        const markup = renderToStaticMarkup(
            <Table.Root label="Hostnames" columns={COLUMNS}>
                <Table.Head>
                    <Table.Column sort="asc" onSort={() => {}}>
                        Name
                    </Table.Column>
                    <Table.Column sort="none" onSort={() => {}}>
                        Requests
                    </Table.Column>
                    <Table.Column>Status</Table.Column>
                </Table.Head>
                <Table.Row>
                    <Table.Cell>app.example.com</Table.Cell>
                    <Table.Cell>12</Table.Cell>
                    <Table.Cell>On</Table.Cell>
                </Table.Row>
            </Table.Root>
        );

        expect(markup).toContain('role="table" aria-label="Hostnames"');
        expect(markup.match(/role="rowgroup"/g)).toHaveLength(1);
        expect(markup.match(/role="row"/g)).toHaveLength(2);
        expect([...markup.matchAll(/role="columnheader"( aria-sort="(\w+)")?/g)].map((match) => match[2] ?? '')).toEqual(['ascending', 'none', '']);
        expect(markup.match(/role="cell"/g)).toHaveLength(3);
        expect(markup.match(/<button type="button"/g)).toHaveLength(2);
        expect(markup).not.toContain('<table');
    });

    test('gives a cell the alignment and the hiding of its column, and drops the hidden tracks from the template', () => {
        const markup = renderToStaticMarkup(
            <Table.Root label="Usage" columns={COLUMNS}>
                <Table.Head>
                    <Table.Column>Name</Table.Column>
                    <Table.Column>Tokens</Table.Column>
                    <Table.Column>Model</Table.Column>
                </Table.Head>
                <Table.Row>
                    <Table.Cell>Main</Table.Cell>
                    <Table.Cell>1,204</Table.Cell>
                    <Table.Cell>Large</Table.Cell>
                </Table.Row>
            </Table.Root>
        );

        const cells = [...markup.matchAll(/<div role="cell"[^>]*>/g)].map((match) => classesOf(match[0]));
        expect(cells[0]).not.toContain('justify-end');
        expect(cells[1]).toEqual(expect.arrayContaining(['justify-end', 'text-end', 'tabular-nums', '@max-md:hidden']));
        expect(cells[2]).toContain('@max-sm:hidden');
        expect(classesOf(tagOf(markup, /role="columnheader"[^>]*@max-md:hidden/))).toContain('justify-end');
        const grid = tagOf(markup, /class="ade-table-grid/);
        expect(grid).toContain('--table-columns:minmax(0,2fr) auto 120px');
        expect(grid).toContain('--table-columns-sm:minmax(0,2fr)');
        expect(grid).toContain('--table-columns-md:minmax(0,2fr) 120px');
        expect(classesOf(grid)).toEqual(expect.arrayContaining(['@max-sm:grid-cols-(--table-columns-sm)', '@max-md:grid-cols-(--table-columns-md)']));
        expect(grid).not.toContain('--table-columns-lg');
    });

    test('says why it has no rows across every column', () => {
        const markup = renderToStaticMarkup(
            <Table.Root label="Clients" columns={COLUMNS}>
                <Table.Empty>No clients yet</Table.Empty>
            </Table.Root>
        );

        const cell = tagOf(markup, /role="cell"/);
        expect(cell).toContain('aria-colspan="3"');
        expect(classesOf(cell)).toEqual(expect.arrayContaining(['col-span-full', 'text-center', 'text-text-muted']));
        expect(markup).toContain('No clients yet</div>');
    });

    test('stands bars in for the rows while it loads, and tells a screen reader only that it is loading', () => {
        const markup = renderToStaticMarkup(
            <Table.Root label="Clients" columns={COLUMNS}>
                <Table.Loading rows={4} />
            </Table.Root>
        );

        expect(markup).toContain('role="rowgroup" aria-busy="true" aria-label="Loading"');
        expect(markup.match(/role="row" aria-hidden="true"/g)).toHaveLength(4);
        expect(markup.match(/animate-pulse/g)).toHaveLength(12);
    });

    test('labels a group with a row across every column', () => {
        const markup = renderToStaticMarkup(
            <Table.Root label="Hostnames" columns={COLUMNS}>
                <Table.Group label="This project">
                    <Table.Row>
                        <Table.Cell>app.example.com</Table.Cell>
                    </Table.Row>
                </Table.Group>
            </Table.Root>
        );

        const id = /role="rowgroup" aria-labelledby="([^"]+)"/.exec(markup)?.[1];
        expect(id).toBeDefined();
        expect(markup).toContain(`id="${id}" aria-colspan="3"`);
        expect(markup).toContain('This project</div>');
    });

    test('keeps its head in place over a body that scrolls only with a maximum height', () => {
        const head = (
            <Table.Head>
                <Table.Column>Name</Table.Column>
            </Table.Head>
        );
        const scrolling = renderToStaticMarkup(
            <Table.Root label="Projects" columns={COLUMNS} maxHeight={240}>
                {head}
            </Table.Root>
        );
        const still = renderToStaticMarkup(
            <Table.Root label="Projects" columns={COLUMNS}>
                {head}
            </Table.Root>
        );

        expect(classesOf(tagOf(scrolling, /class="ade-table-head/))).toEqual(expect.arrayContaining(['sticky', 'top-0', 'bg-surface']));
        expect(tagOf(scrolling, /class="ade-scroll-viewport ade-table-grid/)).toContain('max-height:240px');
        expect(classesOf(tagOf(still, /class="ade-table-head/))).not.toContain('sticky');
        expect(still).not.toContain('ade-scroll-area');
    });

    test('frames itself only when asked', () => {
        const framed = renderToStaticMarkup(<Table.Root label="Projects" columns={COLUMNS} framed />);
        const bare = renderToStaticMarkup(<Table.Root label="Projects" columns={COLUMNS} />);

        expect(classesOf(tagOf(framed, /role="table"/))).toEqual(expect.arrayContaining(['border', 'border-border', 'rounded-lg', 'overflow-clip']));
        expect(classesOf(tagOf(bare, /role="table"/))).not.toContain('border');
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/table/table.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a table row under the pointer and the keyboard', () => {
    let container: HTMLDivElement;
    let clicks: number;
    let root: Root;

    const mount = async (node: ReactNode): Promise<HTMLElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));

        return container.querySelector<HTMLElement>('[role="row"]')!;
    };

    const clickable = (
        <Table.Root label="Projects" columns={COLUMNS}>
            <Table.Row onClick={() => clicks++}>
                <Table.Cell>Site</Table.Cell>
                <Table.Cell>
                    <button type="button">Remove</button>
                </Table.Cell>
            </Table.Row>
        </Table.Root>
    );

    const press = async (target: HTMLElement, key: string): Promise<void> => {
        await act(async () => {
            target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    beforeEach(() => {
        clicks = 0;
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('is a tab stop that a click, Enter and Space activate', async () => {
        const row = await mount(clickable);
        expect(row.tabIndex).toBe(0);
        await act(async () => row.click());
        await press(row, 'Enter');
        await press(row, ' ');
        await press(row, 'a');
        expect(clicks).toBe(3);
    });

    test('leaves a click and a key on a control inside it to the control', async () => {
        const row = await mount(clickable);
        const button = row.querySelector('button')!;
        await act(async () => button.click());
        await press(button, 'Enter');
        expect(clicks).toBe(0);
    });

    test('keeps its click but leaves the tab order to its own control when not focusable', async () => {
        const row = await mount(
            <Table.Root label="Projects" columns={COLUMNS}>
                <Table.Row focusable={false} onClick={() => clicks++}>
                    <Table.Cell>
                        <input type="checkbox" aria-label="Pick Site" />
                    </Table.Cell>
                    <Table.Cell>Site</Table.Cell>
                </Table.Row>
            </Table.Root>
        );

        await act(async () => row.querySelector<HTMLElement>('[role="cell"]:last-child')!.click());
        await press(row, 'Enter');

        expect(row.hasAttribute('tabindex')).toBe(false);
        expect(row.className).toContain('hover:bg-surface-hover');
        expect(clicks).toBe(1);
    });

    test('is no tab stop without a click handler', async () => {
        const row = await mount(
            <Table.Root label="Projects" columns={COLUMNS}>
                <Table.Row>
                    <Table.Cell>Site</Table.Cell>
                </Table.Row>
            </Table.Root>
        );

        expect(row.hasAttribute('tabindex')).toBe(false);
        expect(row.className).not.toContain('hover:bg-surface-hover');
    });
});
