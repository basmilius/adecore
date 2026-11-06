import { expect, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHostProvider, useChatHost, type ChatHost, type ChatHostLayer } from './host';

function Probe({ onHost }: { onHost(host: ChatHost): void }) {
    onHost(useChatHost());

    return null;
}

function read(...hosts: ChatHostLayer[]): ChatHost {
    let seen: ChatHost | null = null;
    const probe = createElement(Probe, { onHost: (host) => (seen = host) });
    renderToStaticMarkup(hosts.reduceRight<ReactNode>((children, host) => createElement(ChatHostProvider, { host }, children), probe));

    return seen!;
}

test('outside a provider the host is the chat without the parts of an app', () => {
    const host = read();
    expect(host.actions).toBeNull();
    expect(host.fileLinks).toBeNull();
    expect(host.useStreaming()).toBe('words');
});

test('a provider inside another keeps what the outer one handed and replaces what it hands itself', () => {
    const notify = () => {};

    const outer = () => 'blocks' as const;

    const inner = () => 'whole' as const;

    const host = read({ notify, useStreaming: outer }, { useStreaming: inner });
    expect(host.notify).toBe(notify);
    expect(host.useStreaming).toBe(inner);
    expect(host.useSendDelivery()).toBe('queue');
});

test('a bundle on both sides is merged one level down, so a layer overrides one member without copying the rest', () => {
    const url = () => ({ url: 'inner', failure: null });

    const host = read(
        { attachments: { useUrl: () => ({ url: 'outer', failure: null }), read: () => Promise.resolve(new Blob()) }, notify: () => {} },
        { attachments: { useUrl: url }, prompts: { render: () => null } }
    );
    expect(host.attachments.useUrl).toBe(url);
    expect(host.attachments.read).toBeDefined();
    expect(host.prompts.answer).toBeDefined();
});

test('a member a layer sets to null replaces the bundle above it', () => {
    const host = read({ fileLinks: { target: () => null, open: () => undefined } }, { fileLinks: null });
    expect(host.fileLinks).toBeNull();
});
