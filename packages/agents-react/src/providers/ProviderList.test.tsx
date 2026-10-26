import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProviderInfo } from '@adecore/agent-contracts';
import type { AccountEntry } from '../agents/accounts';
import type { Picked } from './pane-target';
import { ProviderList } from './ProviderList';
import type { ProviderGroups, ProviderRow } from './provider-groups';

const providerOf = (kind: string, name: string, installed = true): ProviderInfo =>
    ({ kind, name, installed, version: '2.1.0', models: [], capabilities: { terminal: true } }) as unknown as ProviderInfo;

function entryOf(id: string, label: string | undefined, plan: string | null, isDefault: boolean): AccountEntry {
    return {
        id,
        isDefault,
        account: { kind: 'claude', label, color: 'blue' },
        status: { id, kind: 'claude', state: 'ready', email: null, plan, organization: null, home: `/home/${id}`, message: null, checkedAt: 1 }
    } as AccountEntry;
}

const emptyGroups: ProviderGroups = { ready: [], setup: [], missing: [] };

function render(groups: Partial<ProviderGroups>, current: Picked | null = null, canAddProvider = false): string {
    return renderToStaticMarkup(
        createElement(ProviderList, { groups: { ...emptyGroups, ...groups }, current, canAddAccount: () => true, canAddProvider, onPick: () => {} })
    );
}

const sectionsIn = (markup: string): string[] => [...markup.matchAll(/<section aria-label="([^"]+)"/g)].map((match) => match[1]!);

describe('ProviderList', () => {
    test('each group has its label, and a group without providers is left out', () => {
        const ready: ProviderRow = { provider: providerOf('claude', 'Claude Code'), entries: [], note: null };
        const setup: ProviderRow = { provider: providerOf('nanogpt', 'Nano'), entries: [], note: { text: 'No key', tone: 'warning' } };

        expect(sectionsIn(render({ ready: [ready], setup: [setup], missing: [providerOf('acme', 'Acme', false)] }))).toEqual([
            'Ready',
            'Needs setup',
            'Not installed'
        ]);

        expect(sectionsIn(render({ ready: [ready] }))).toEqual(['Ready']);
    });

    test('a provider with one account shows its plan and no account row or Default pill', () => {
        const markup = render({
            ready: [{ provider: providerOf('codex', 'Codex'), entries: [entryOf('codex', undefined, 'pro', true)], note: { text: 'pro', tone: 'muted' } }]
        });

        expect(markup).toContain('>pro<');
        expect(markup).not.toContain('Default');
        expect(markup).not.toContain('2.1.0');
    });

    test('several accounts sit under the provider, each with its plan, and only the default one wears the pill', () => {
        const entries = [entryOf('claude', 'Work', 'max', true), entryOf('claude_private', 'Private', 'pro', false)];
        const markup = render({ ready: [{ provider: providerOf('claude', 'Claude Code'), entries, note: null }] });
        expect(markup).toContain('Work');
        expect(markup).toContain('Private');
        expect(markup).toContain('>max<');
        expect(markup).toContain('>pro<');
        expect(markup.match(/>Default</g)).toHaveLength(1);
    });

    test('the setup status reads in its tone', () => {
        const markup = render({ setup: [{ provider: providerOf('nanogpt', 'Nano'), entries: [], note: { text: 'No key', tone: 'warning' } }] });
        expect(markup).toMatch(/text-status-needs-you[^>]*>No key</);
    });

    test('picking the one account of a provider lights up the provider', () => {
        const markup = render(
            { ready: [{ provider: providerOf('codex', 'Codex'), entries: [entryOf('codex', undefined, 'pro', true)], note: null }] },
            { kind: 'account', id: 'codex' }
        );

        expect(markup).toContain('aria-current="true"');
    });

    test('ends in a row that adds a provider only for a host with a page for it', () => {
        const ready: ProviderRow = { provider: providerOf('claude', 'Claude Code'), entries: [], note: null };
        expect(render({ ready: [ready] })).not.toContain('Add provider');
        expect(render({ ready: [ready] }, null, true)).toContain('Add provider');
        expect(render({ ready: [ready] }, { kind: 'catalog' }, true)).toMatch(/aria-current="true"[^>]*>(?:(?!<\/button>).)*Add provider/);
    });
});
