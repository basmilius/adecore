import { expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatHostProvider, takeHostReplacement, useChatHost, type ChatHost, type ChatHostLayer } from './host';

function Probe({ seen }: { seen: ChatHost[] }) {
    seen.push(useChatHost());

    return null;
}

test('under a dev server that replaces modules the host value changes only when the host or the one above it does', async () => {
    takeHostReplacement(true);
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    const seen: ChatHost[] = [];
    const render = async (host: ChatHostLayer) => act(async () => root.render(createElement(ChatHostProvider, { host }, createElement(Probe, { seen }))));
    const first: ChatHostLayer = {};
    const second: ChatHostLayer = {};

    try {
        await render(first);
        await render(first);

        expect(seen.at(-1)).toBe(seen.at(-2));

        await render(second);

        expect(seen.at(-1)).not.toBe(seen.at(-2));

        await render(second);
        await render(second);

        expect(seen.at(-1)).toBe(seen.at(-2));
        expect(seen.at(-2)).toBe(seen.at(-3));
    } finally {
        takeHostReplacement(false);
        await act(async () => root.unmount());
        element.remove();
    }
});
