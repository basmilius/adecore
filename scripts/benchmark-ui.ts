import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UiCompiler } from '../packages/intelligent-ui/src/compiler';
import { AttachmentStore } from '../packages/agents/src/chat/attachment-store';
import type { BackendHost } from '../packages/agents/src/chat/backend';
import { ChatCore } from '../packages/agents/src/chat/chat-core';
import { parseLog } from '../packages/agents/src/chat/chat-log';
import { ChatStore } from '../packages/agents/src/chat/chat-store';
import { claudeProvider } from '../packages/agents/src/providers/claude-provider';
import { ProviderRegistry } from '../packages/agents/src/providers/registry';

function distribution(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
    return { samples: sorted.length, p50Ms: at(0.5), p95Ms: at(0.95), maxMs: at(1) };
}

function scan(text: string) {
    new UiCompiler({ id: 'warmup' }).compile(text);
    const durations: number[] = [];
    let blocks = 0;
    for (let sample = 0; sample < 20; sample++) {
        const compiler = new UiCompiler({ id: 'scan' });
        const started = performance.now();
        blocks = compiler.compile(text).length;
        durations.push(performance.now() - started);
    }
    return { utf16Units: text.length, blocks, ...distribution(durations) };
}

async function stream(text: string) {
    const folder = await mkdtemp(join(tmpdir(), 'adecore-ui-benchmark-'));
    const attachments = new AttachmentStore(folder);
    const store = new ChatStore(folder, { attachments });
    let host: BackendHost | undefined;
    const core = new ChatCore({
        attachments,
        store,
        providers: new ProviderRegistry({
            detect: async () => ({ installed: true, version: 'benchmark' }),
            providers: [
                {
                    ...claudeProvider,
                    createBackend: (_launch, backendHost) => {
                        host = backendHost;
                        return {
                            running: true,
                            pid: null,
                            start: async () => undefined,
                            sendTurn: () => undefined,
                            compact: () => undefined,
                            interrupt: () => undefined,
                            respondApproval: () => false,
                            respondQuestion: () => false,
                            stop: () => undefined,
                            dispose: async () => undefined
                        };
                    }
                }
            ]
        })
    });
    let previews = 0;
    let previewBytes = 0;
    core.subscribe('benchmark', (event) => {
        if (event.event === 'chat.event' && event.payload.event.type === 'delta' && event.payload.event.ui) {
            previews++;
            previewBytes += Buffer.byteLength(JSON.stringify(event.payload.event.ui));
        }
    });
    const eventLoop: number[] = [];
    let expected = performance.now() + 10;
    const timer = setInterval(() => {
        const now = performance.now();
        eventLoop.push(Math.max(0, now - expected));
        expected = now + 10;
    }, 10);
    try {
        await core.create({ chatId: 'benchmark', cwd: folder });
        core.attach('benchmark', 'benchmark');
        await core.send('benchmark', 'Measure a reply');
        for (let attempt = 0; !host && attempt < 50; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        if (!host) {
            throw new Error('The fixture backend did not start');
        }
        const eventDurations: number[] = [];
        const step = Math.ceil(text.length / 100);
        for (let position = 0; position < text.length; position += step) {
            const started = performance.now();
            host.onEvent({ type: 'text.delta', ref: 'answer', text: text.slice(position, position + step) });
            eventDurations.push(performance.now() - started);
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const finalStarted = performance.now();
        host.onEvent({ type: 'text.done', ref: 'answer', text, parentRef: null });
        const finalMs = performance.now() - finalStarted;
        await new Promise((resolve) => setTimeout(resolve, 20));
        const replay: number[] = [];
        let record = await store.read('benchmark');
        for (let sample = 0; sample < 20; sample++) {
            const started = performance.now();
            record = await store.read('benchmark');
            replay.push(performance.now() - started);
        }
        const assistant = record?.items.find((item) => item.kind === 'assistant');
        const logged = parseLog(await readFile(store.logPath('benchmark'), 'utf8').catch(() => ''));
        return {
            utf16Units: text.length,
            textBytes: Buffer.byteLength(text),
            previews,
            previewBytes,
            loggedPreviews: logged.filter((line) => line.event.type === 'delta' && line.event.ui).length,
            logBytes: (await stat(store.logPath('benchmark')).catch(() => null))?.size ?? 0,
            finalUiBytes: assistant?.kind === 'assistant' ? Buffer.byteLength(JSON.stringify(assistant.ui ?? [])) : 0,
            blocks: assistant?.kind === 'assistant' ? (assistant.ui?.length ?? 0) : 0,
            delta: distribution(eventDurations),
            finalMs,
            eventLoop: distribution(eventLoop),
            replay: distribution(replay)
        };
    } finally {
        clearInterval(timer);
        await core.shutdown();
        for (const info of core.list()) {
            await core.get(info.chatId)?.dispose();
        }
        await rm(folder, { recursive: true, force: true });
    }
}

const fence = '```ui\n<Summary>Done</Summary>\n```\n';
const typical =
    'Before\n```ui\n<Summary>Build results</Summary><Stats>' +
    Array.from({ length: 100 }, (_, index) => `<Stat label="Check ${index}" value={${index}}/>`).join('') +
    '</Stats>\n```\nAfter';
console.log(
    JSON.stringify(
        {
            runtime: Bun.version,
            platform: `${process.platform}/${process.arch}`,
            scans: {
                longProse: scan('ordinary prose line\n'.repeat(100000)),
                proseBeforeUi: scan('ordinary prose line\n'.repeat(100000) + fence),
                manyFences: scan(fence.repeat(100000))
            },
            streams: {
                typical: await stream(typical),
                longReply: await stream('ordinary prose line\n'.repeat(100000) + fence)
            }
        },
        null,
        2
    )
);
