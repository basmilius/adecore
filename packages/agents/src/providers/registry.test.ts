import { describe, expect, test } from 'bun:test';
import { claudeProvider } from './claude-provider.ts';
import type { ChatProvider } from './provider.ts';
import { ProviderRegistry, unofferedProvider } from './registry.ts';

describe('ProviderRegistry.list', () => {
    test('passes on how a provider installs', async () => {
        const registry = new ProviderRegistry({ detect: async () => ({ installed: false, version: null }), providers: [claudeProvider], env: {} });
        const [claude] = await registry.list();
        expect(claude?.install?.commands.darwin).toContain('install.sh');
        expect(claude?.install?.signIn[0]).toEqual({ kind: 'command', command: 'claude auth login' });
    });

    test('leaves the field out for a provider without one', async () => {
        const { install: _install, ...bare } = claudeProvider;
        const registry = new ProviderRegistry({ detect: async () => ({ installed: true, version: '1' }), providers: [bare], env: {} });
        const [claude] = await registry.list();
        expect(claude).not.toHaveProperty('install');
    });
});

describe('ProviderRegistry.add and remove', () => {
    const installed = async () => ({ installed: true, version: '1' });

    function learning(kind: string): { provider: ChatProvider; learn(): void } {
        const listeners = new Set<() => void>();

        const provider: ChatProvider = {
            ...unofferedProvider(kind),
            onChange: (listener) => {
                listeners.add(listener);

                return () => listeners.delete(listener);
            }
        };

        return {
            provider,
            learn: () => {
                for (const listener of listeners) {
                    listener();
                }
            }
        };
    }

    test('offers a provider added after the start, and tells the listeners', async () => {
        const registry = new ProviderRegistry({ detect: installed, providers: [claudeProvider], env: {} });
        const heard: string[] = [];
        registry.onChange((kind) => heard.push(kind));
        const extra = learning('example');
        registry.add(extra.provider);
        expect(registry.kinds()).toEqual(['claude', 'example']);
        expect((await registry.list()).map((provider) => provider.kind)).toEqual(['claude', 'example']);
        extra.learn();
        expect(heard).toEqual(['example', 'example']);
    });

    test('puts a provider in the place of the one of its kind and lets the old one go', () => {
        const registry = new ProviderRegistry({ detect: installed, providers: [claudeProvider], env: {} });
        const heard: string[] = [];
        const first = learning('example');
        const second = learning('example');
        registry.add(first.provider);
        registry.onChange((kind) => heard.push(kind));
        registry.add(second.provider);
        first.learn();
        expect(registry.get('example')).toBe(second.provider);
        expect(heard).toEqual(['example']);
    });

    test('removes a kind, which then gets the stand-in', () => {
        const providers = [claudeProvider];
        const registry = new ProviderRegistry({ detect: installed, providers, env: {} });
        const extra = learning('example');
        const heard: string[] = [];
        registry.add(extra.provider);
        registry.onChange((kind) => heard.push(kind));
        registry.remove('example');
        extra.learn();
        expect(registry.kinds()).toEqual(['claude']);
        expect(registry.get('example').capabilities.chat).toBe(false);
        expect(heard).toEqual(['example']);
        // The array the host passed stays as it was.
        expect(providers).toEqual([claudeProvider]);
    });

    test('stops following the providers once the last listener stops', () => {
        const registry = new ProviderRegistry({ detect: installed, providers: [], env: {} });
        const extra = learning('example');
        const heard: string[] = [];
        registry.add(extra.provider);
        const stop = registry.onChange((kind) => heard.push(kind));
        stop();
        extra.learn();
        expect(heard).toEqual([]);
    });
});
