import { describe, expect, test } from 'bun:test';
import { pickerGroupsOf, ProviderInstallSchema } from './model.ts';

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
