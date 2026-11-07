import { describe, expect, test } from 'bun:test';
import { codexProvider } from '../providers/codex-provider.ts';
import type { ChatProvider } from '../providers/provider.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { suggestChatTitle } from './chat-title.ts';

function scripted(script: string): ChatProvider {
    return { ...codexProvider, command: ['bun'], oneShotArgs: () => ['-e', script] };
}

function registryWith(installed: string[], providers: ChatProvider[]): ProviderRegistry {
    return new ProviderRegistry({
        providers,
        detect: async (command) => ({ installed: installed.includes(command), version: installed.includes(command) ? '1.0.0' : null })
    });
}

describe('suggestChatTitle', () => {
    const input = { cwd: process.cwd(), prompt: 'Why does the build fail?', answer: 'The lockfile is stale.' };

    test('runs the one-shot CLI and parses what it printed', async () => {
        const good = scripted(`console.log('working...'); console.log(JSON.stringify({ title: 'Stale lockfile.' }))`);
        expect(await suggestChatTitle(registryWith(['bun'], [good]), 'codex', input)).toBe('Stale lockfile');
    });

    test('a CLI that fails or prints no title gives nothing', async () => {
        const failing = scripted(`console.log(JSON.stringify({ title: 'Nope' })); process.exit(1)`);
        expect(await suggestChatTitle(registryWith(['bun'], [failing]), 'codex', input)).toBeNull();
        const chatty = scripted(`console.log('Stale lockfile')`);
        expect(await suggestChatTitle(registryWith(['bun'], [chatty]), 'codex', input)).toBeNull();
    });
});

describe('suggestChatTitle under an account', () => {
    const input = { cwd: process.cwd(), prompt: 'Why does the build fail?', answer: 'The lockfile is stale.' };
    const printsAccount = `console.log(JSON.stringify({ title: process.env.REVIEW_ACCOUNT ?? 'daemon-default' }))`;
    const env = { ...(process.env as Record<string, string>), REVIEW_ACCOUNT: 'work-account' };

    function grokLike(script: string): ChatProvider {
        return { ...scripted(script), kind: 'grok' };
    }

    test('the one-shot of the chat own CLI runs with the environment of the chat account', async () => {
        const registry = registryWith(['bun'], [grokLike(printsAccount)]);

        expect(await suggestChatTitle(registry, 'grok', { ...input, account: 'grok_work', env })).toBe('work-account');
    });

    test('a chat on an extra account is never named by another CLI, with its environment or without it', async () => {
        const other = scripted(printsAccount);
        const registry = registryWith(['bun'], [other]);

        expect(await suggestChatTitle(registry, 'grok', { ...input, account: 'grok_work', env })).toBeNull();
        expect(await suggestChatTitle(registry, 'grok', { ...input, account: 'grok_work' })).toBeNull();
    });

    test('a chat on the default account may fall back to another CLI, without the environment of its own CLI', async () => {
        const registry = registryWith(['bun'], [scripted(printsAccount)]);

        expect(await suggestChatTitle(registry, 'grok', { ...input, env })).toBe('daemon-default');
    });
});
