import { describe, expect, test } from 'bun:test';
import { inPickerOrder, pickerGroupsOf, ProviderInstallSchema, separatesGroups } from './model.ts';

describe('pickerGroupsOf', () => {
    const provider = (kind: string, name: string) => ({ kind, name });

    test('puts the frontier labs first and the API providers last, every group in order of name', () => {
        const groups = pickerGroupsOf([
            provider('grok', 'Grok'),
            provider('codex', 'Codex'),
            provider('copilot', 'GitHub Copilot'),
            provider('claude', 'Claude Code'),
            provider('nanogpt', 'NanoGPT'),
            provider('anthropic-claude-api', 'Claude API'),
            provider('kimi', 'Kimi'),
            provider('antigravity', 'Antigravity')
        ]);

        expect(groups.frontier.map((entry) => entry.name)).toEqual(['Claude Code', 'Codex']);
        expect(groups.others.map((entry) => entry.name)).toEqual(['Antigravity', 'GitHub Copilot', 'Grok', 'Kimi']);
        expect(groups.api.map((entry) => entry.name)).toEqual(['Claude API', 'NanoGPT']);
    });

    test('sorts regardless of case and leaves the list it was given alone', () => {
        const providers = [provider('apple', 'b'), provider('acp-agent', 'A')];
        expect(pickerGroupsOf(providers)).toEqual({ frontier: [], others: [provider('acp-agent', 'A'), provider('apple', 'b')], api: [] });
        expect(providers[0]!.name).toBe('b');
    });
});

describe('inPickerOrder', () => {
    test('lists the frontier labs, the rest and the API providers, with a separator only where a group ends', () => {
        const ordered = inPickerOrder([
            { kind: 'nanogpt', name: 'NanoGPT' },
            { kind: 'grok', name: 'Grok' },
            { kind: 'codex', name: 'Codex' },
            { kind: 'anthropic-claude-api', name: 'Claude API' },
            { kind: 'antigravity', name: 'Antigravity' },
            { kind: 'claude', name: 'Claude Code' }
        ]).map((entry) => entry.kind);

        expect(ordered).toEqual(['claude', 'codex', 'antigravity', 'grok', 'anthropic-claude-api', 'nanogpt']);
        expect(ordered.map((kind, i) => separatesGroups(ordered[i - 1], kind))).toEqual([false, false, true, false, true, false]);
    });

    test('puts no separator above the first provider or inside a group', () => {
        expect(separatesGroups(undefined, 'grok')).toBe(false);
        expect(separatesGroups('copilot', 'grok')).toBe(false);
        expect(separatesGroups('antigravity', 'grok')).toBe(false);
        expect(separatesGroups('claude', 'nanogpt')).toBe(true);
        expect(separatesGroups('claude', 'codex')).toBe(false);
        expect(separatesGroups('codex', 'antigravity')).toBe(true);
        expect(separatesGroups('grok', 'anthropic-claude-api')).toBe(true);
        expect(separatesGroups('anthropic-claude-api', 'nanogpt')).toBe(false);
    });
});

describe('ProviderInstallSchema', () => {
    test('leaves out a way to sign in this version does not know, and keeps the rest', () => {
        const install = ProviderInstallSchema.parse({
            description: 'An agent',
            commands: { darwin: 'brew install agent' },
            signIn: [{ kind: 'command', command: 'agent login' }, { kind: 'passkey', origin: 'https://example.com' }, { kind: 'chat' }]
        });

        expect(install.signIn).toEqual([{ kind: 'command', command: 'agent login' }, { kind: 'chat' }]);
    });

    test('leaves out a way whose fields do not parse', () => {
        const install = ProviderInstallSchema.parse({ description: 'An agent', commands: {}, signIn: [{ kind: 'env' }] });
        expect(install.signIn).toEqual([]);
    });
});
