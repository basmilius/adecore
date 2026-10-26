import { describe, expect, test } from 'bun:test';
import type { ChatSpawnOptions, SpawnChatProcess } from '../chat/chat-process.ts';
import { detectCli } from './detect.ts';

function answering(output: string, seen: ChatSpawnOptions[]): SpawnChatProcess {
    return (options) => {
        seen.push(options);
        queueMicrotask(() => options.onExit(0));

        return {
            pid: 1,
            stdin: { write: () => true, flush: () => undefined, end: () => undefined },
            stdout: new Response(output).body!,
            kill: () => undefined
        };
    };
}

describe('detectCli', () => {
    test('puts the flags before --version', async () => {
        const seen: ChatSpawnOptions[] = [];
        const detection = await detectCli('grok', {}, answering('grok 1.0.62 (1474f9cbdd91) [stable]\n', seen), ['--no-auto-update']);
        expect(seen[0]?.command).toEqual(['grok', '--no-auto-update', '--version']);
        expect(detection).toEqual({ installed: true, version: '1.0.62' });
    });
});
