import { expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { compileUiBlock } from '@adecore/intelligent-ui';
import { chatHost, setChatHost } from '../../../host';
import { UiReply } from './UiReply';

test.skipIf(typeof document === 'undefined')('changing a query input closes its choice until matching data is read', async () => {
    const observer = globalThis.IntersectionObserver;
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    const previous = chatHost().intelligentUi;
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    let refresh = () => {};
    const sends: unknown[] = [];
    const reads: unknown[] = [];
    const source =
        '$flag = false\n$data = @Query("status", {flag: $flag})\n<Stats><Stat label="Count" value={$data.count}/></Stats><Switch value={$flag}>Flag</Switch><Choices><Choice>Choose</Choice></Choices>';
    const text = '```ui\n' + source + '\n```';
    const block = compileUiBlock(source, { id: 'query-choice-test', final: true, querySchemas: { status: z.object({ flag: z.boolean() }) } });
    expect(block.diagnostics).toEqual([]);
    block.revision = 'revision';
    block.start = 0;
    block.end = text.length;
    setChatHost({
        intelligentUi: {
            query: async (_scope, payload) => {
                reads.push(payload.values);
                if (reads.length === 3) {
                    throw new Error('Unavailable');
                }
                return { state: 'fresh', value: { count: reads.length }, readId: `reading-${reads.length}`, readAt: Date.now() };
            },
            subscribe: (_scope, _chat, listener) => {
                refresh = listener;
                return () => {};
            },
            sendChoice: async (_scope, payload) => {
                sends.push(payload);
                return 'sent';
            }
        }
    });
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    try {
        await act(async () =>
            root.render(
                createElement(UiReply, {
                    text,
                    blocks: [block],
                    context: { scopeId: 'query-test', chatId: 'chat', itemId: 'item', phase: 'final', answer: null }
                })
            )
        );
        const choose = () => [...element.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Choose')!;
        expect(choose().getAttribute('aria-disabled')).not.toBe('true');
        expect(reads).toEqual([{ $flag: false }]);
        const toggle = element.querySelector<HTMLElement>('[role="switch"]')!;
        await act(async () => {
            toggle.click();
        });
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        expect(choose().getAttribute('aria-disabled')).toBe('true');
        await act(async () => {
            choose().click();
        });
        expect(sends).toEqual([]);
        now += 10_001;
        await act(async () => refresh());
        expect(choose().getAttribute('aria-disabled')).not.toBe('true');
        expect(element.querySelector('.chat-ui-changed')?.textContent).toBe('2');
        now += 10_001;
        await act(async () => refresh());
        expect(element.querySelector('.text-lg')?.textContent).toBe('2');
        expect(element.querySelector('.text-lg')?.classList.contains('text-text-muted')).toBe(true);
        await act(async () => choose().click());
        expect(sends).toMatchObject([{ values: { $flag: true }, reads: { $data: 'reading-2' } }]);
    } finally {
        await act(async () => root.unmount());
        element.remove();
        Date.now = originalNow;
        setChatHost({ intelligentUi: previous });
        Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: observer });
    }
});

/* A block with one query on a Switch and one Choice, mounted with `query` as the host's reader. */
async function mountQueryBlock(scopeId: string, query: NonNullable<NonNullable<ReturnType<typeof chatHost>['intelligentUi']>['query']>) {
    const source =
        '$flag = false\n$data = @Query("status", {flag: $flag})\n<Stats><Stat label="Count" value={$data.count}/></Stats><Switch value={$flag}>Flag</Switch><Choices><Choice>Choose</Choice></Choices>';
    const text = '```ui\n' + source + '\n```';
    const block = compileUiBlock(source, { id: `${scopeId}-block`, final: true, querySchemas: { status: z.object({ flag: z.boolean() }) } });
    block.revision = 'revision';
    block.start = 0;
    block.end = text.length;
    let refresh = () => {};
    const host = (read: typeof query) => ({
        query: read,
        subscribe: (_scope: string, _chat: string, listener: () => void) => {
            refresh = listener;
            return () => {};
        },
        sendChoice: async () => 'sent' as const
    });
    setChatHost({ intelligentUi: host(query) });
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    const draw = () =>
        root.render(createElement(UiReply, { text, blocks: [block], context: { scopeId, chatId: 'chat', itemId: 'item', phase: 'final', answer: null } }));
    await act(async () => draw());
    return {
        element,
        choose: () => [...element.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Choose')!,
        refresh: () => refresh(),
        /* Hands the view a new reader, which runs the query effect's cleanup and starts it again. */
        swap: async (read: typeof query) => {
            setChatHost({ intelligentUi: host(read) });
            await act(async () => draw());
        },
        unmount: async () => {
            await act(async () => root.unmount());
            element.remove();
        }
    };
}

test.skipIf(typeof document === 'undefined')('a read its cleanup cut short leaves the choices open on the reading before it', async () => {
    const observer = globalThis.IntersectionObserver;
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    const previous = chatHost().intelligentUi;
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    let count = 0;
    const view = await mountQueryBlock('cleanup-test', async () => {
        count++;
        if (count === 2) {
            return new Promise(() => {});
        }
        return { state: 'fresh', value: { count }, readId: `reading-${count}`, readAt: Date.now() };
    });
    try {
        expect(view.choose().getAttribute('aria-disabled')).not.toBe('true');
        now += 10_001;
        await act(async () => view.refresh());
        expect(view.choose().getAttribute('aria-disabled')).toBe('true');
        await view.swap(async () => ({ state: 'fresh', value: { count: 9 }, readId: 'reading-9', readAt: Date.now() }));
        expect(view.choose().getAttribute('aria-disabled')).not.toBe('true');
    } finally {
        await view.unmount();
        Date.now = originalNow;
        setChatHost({ intelligentUi: previous });
        Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: observer });
    }
});

test.skipIf(typeof document === 'undefined')('a changed input reads once it rested, not after the refresh interval', async () => {
    const observer = globalThis.IntersectionObserver;
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: undefined });
    const previous = chatHost().intelligentUi;
    const reads: unknown[] = [];
    const view = await mountQueryBlock('settle-test', async (_scope, payload) => {
        reads.push(payload.values);
        return { state: 'fresh', value: { count: reads.length }, readId: `reading-${reads.length}`, readAt: Date.now() };
    });
    try {
        const toggle = view.element.querySelector<HTMLElement>('[role="switch"]')!;
        await act(async () => toggle.click());
        await act(async () => toggle.click());
        await act(async () => toggle.click());
        expect(reads).toEqual([{ $flag: false }]);
        expect(view.choose().getAttribute('aria-disabled')).toBe('true');
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
        });
        expect(reads).toEqual([{ $flag: false }, { $flag: true }]);
        expect(view.choose().getAttribute('aria-disabled')).not.toBe('true');
    } finally {
        await view.unmount();
        setChatHost({ intelligentUi: previous });
        Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, writable: true, value: observer });
    }
});

test.skipIf(typeof document === 'undefined')('a citation reveals and focuses its Source without opening its URL', async () => {
    const scroll = HTMLElement.prototype.scrollIntoView;
    const previous = chatHost().intelligentUi;
    HTMLElement.prototype.scrollIntoView = () => {};
    const urls: string[] = [];
    const text =
        '```ui\n<Callout tone="info">Read [1].</Callout><Sections><Section title="References"><Tabs><Tab title="Other"><Summary>Other</Summary></Tab><Tab title="Links"><Sources><Source title="Docs" url="https://adecore.dev"/></Sources></Tab></Tabs></Section></Sections>\n```';
    const { compileUi } = await import('@adecore/intelligent-ui');
    const blocks = compileUi(text, { id: 'source-dom', final: true });
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    try {
        await act(async () =>
            root.render(
                createElement(UiReply, {
                    text,
                    blocks,
                    context: { scopeId: 'citation-test', chatId: 'chat', itemId: 'item', phase: 'final', answer: null, openUrl: (url) => urls.push(url) }
                })
            )
        );
        const chip = element.querySelector<HTMLButtonElement>('button[aria-label="Source 1: Docs"]')!;
        expect(chip).not.toBeNull();
        const section = element.querySelector<HTMLButtonElement>('[aria-expanded]')!;
        await act(async () => section.click());
        expect(section.getAttribute('aria-expanded')).toBe('false');
        await act(async () => {
            chip.click();
            await new Promise((resolve) => setTimeout(resolve, 30));
        });
        expect(section.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(element.querySelector('[data-ui-source]'));
        expect(urls).toEqual([]);
        await act(async () => element.querySelector<HTMLButtonElement>('[data-ui-source] button')!.click());
        expect(urls).toEqual(['https://adecore.dev']);
    } finally {
        await act(async () => root.unmount());
        element.remove();
        HTMLElement.prototype.scrollIntoView = scroll;
        setChatHost({ intelligentUi: previous });
    }
});
