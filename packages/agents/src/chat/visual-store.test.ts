import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VISUAL_LIMITS, type ChatVisual } from '@adecore/agent-contracts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatStore } from './chat-store.ts';
import { VisualStore, isVisualFileName, visualFileName } from './visual-store.ts';

let home: string;
let attachments: AttachmentStore;
let store: VisualStore;
let clock: number;
let told: Array<{ chatId: string; visuals: ChatVisual[] }>;

const PAGE = '<!doctype html><html><head><title>Revenue</title></head><body><svg></svg></body></html>';

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'agents-visuals-'));
    attachments = new AttachmentStore(home);
    clock = 1000;
    store = new VisualStore(home, attachments, { now: () => clock++ });
    told = [];
    store.listen((chatId, visuals) => told.push({ chatId, visuals }));
});

afterEach(async () => {
    await rm(home, { recursive: true, force: true });
});

describe('VisualStore', () => {
    test('keeps editable sources and previews beside the chat, separately from published attachments', async () => {
        const source = await store.writeSource('chat/1', 'chart.html', PAGE);
        expect(source).toBe(join(home, 'chats', 'chat%2F1.visuals', 'chart.html'));
        expect((await stat(store.workspacePath('chat/1'))).mode & 0o777).toBe(0o700);
        expect((await stat(source)).mode & 0o777).toBe(0o600);
        expect(await readFile(source, 'utf8')).toBe(PAGE);
        await store.writeSource('chat/1', 'chart.html', '<p>Updated</p>');
        const png = new Uint8Array([137, 80, 78, 71]);
        const preview = await store.writePreview('chat/1', png);
        const otherPreview = await store.writePreview('chat/1', png);
        expect(preview).not.toBe(otherPreview);
        expect(await readFile(preview)).toEqual(Buffer.from(png));
        expect(await store.list('chat/1')).toEqual([]);
        expect(told).toEqual([]);
        expect(await new ChatStore(home, { attachments }).list()).toEqual([]);
        const published = await store.publish('chat/1', { title: 'Chart', html: PAGE });
        await store.copyChat('chat/1', 'fork');
        const otherSource = await store.writeSource('chat-2', 'chart.html', '<p>Other chat</p>');
        await store.removeChat('chat/1');
        expect(await Bun.file(source).exists()).toBe(false);
        expect(await Bun.file(preview).exists()).toBe(false);
        expect(await Bun.file(store.pagePath('fork', published.id)).exists()).toBe(true);
        await expect(stat(store.workspacePath('chat/1'))).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await readFile(otherSource, 'utf8')).toBe('<p>Other chat</p>');
    });

    test('refuses source paths and invalid pages without writing outside the chat', async () => {
        for (const name of ['../other.html', '/tmp/page.html', 'nested/page.html', 'nested\\page.html', '.html', 'page.js']) {
            await expect(store.writeSource('chat-1', name, PAGE)).rejects.toMatchObject({ code: 'visual-invalid' });
        }
        await expect(store.writeSource('chat-1', 'page.html', ' ')).rejects.toMatchObject({ code: 'visual-invalid' });
        await expect(store.writeSource('chat-1', 'page.html', 'x'.repeat(VISUAL_LIMITS.bytes + 1))).rejects.toMatchObject({ code: 'visual-too-large' });
        expect(await readdir(home)).toEqual([]);
    });

    test('publishes a page with its bootstrap in the attachment folder and keeps it in the list', async () => {
        const visual = await store.publish('chat 1', { title: '  Revenue  ', html: PAGE, turnId: 'turn-1' });
        expect(visual).toEqual({
            id: expect.stringMatching(/^[0-9a-f]{16}$/),
            title: 'Revenue',
            at: 1000,
            maxHeight: 2000,
            size: visual.size,
            turnId: 'turn-1'
        });
        const path = join(home, 'attachments', encodeURIComponent('chat 1'), `${visual.id}.html`);
        expect(store.pagePath('chat 1', visual.id)).toBe(path);
        const page = await readFile(path, 'utf8');
        expect(page).toStartWith('<!doctype html><html><head><meta charset="utf-8">');
        expect(page).toEndWith('<title>Revenue</title></head><body><svg></svg></body></html>');
        expect(visual.size).toBe(Buffer.byteLength(page));
        expect(await new VisualStore(home, attachments).list('chat 1')).toEqual([visual]);
        expect(told).toEqual([{ chatId: 'chat 1', visuals: [visual] }]);
    });

    test('keeps the chosen layout after a restart and a chat copy', async () => {
        for (const layout of ['inline', 'wide'] as const) {
            const visual = await store.publish('chat-1', { title: layout, html: PAGE, layout });
            expect(visual.layout).toBe(layout);
        }
        const restarted = new VisualStore(home, attachments);
        expect((await restarted.list('chat-1')).map((visual) => visual.layout)).toEqual(['inline', 'wide']);
        await restarted.copyChat('chat-1', 'fork');
        expect((await new VisualStore(home, attachments).list('fork')).map((visual) => visual.layout)).toEqual(['inline', 'wide']);
        await expect(store.publish('chat-1', { title: 'Bad layout', html: PAGE, layout: 'fullscreen' as 'wide' })).rejects.toMatchObject({
            code: 'visual-invalid'
        });
    });

    test('serves a page as an attachment of its chat, as text/html', async () => {
        const visual = await store.publish('chat-1', { title: 'Revenue', html: PAGE });
        expect(store.attachment('chat-1', visual.id)).toEqual({
            id: visual.id,
            name: 'Revenue.html',
            mime: 'text/html',
            size: visual.size,
            path: store.pagePath('chat-1', visual.id)
        });
        expect(store.attachment('chat-2', visual.id)).toBeNull();
        expect(store.attachment('chat-1', 'other')).toBeNull();
        // A store that only read the list after a restart knows the page too.
        const again = new VisualStore(home, attachments);
        expect(again.attachment('chat-1', visual.id)).toBeNull();
        await again.list('chat-1');
        expect(again.attachment('chat-1', visual.id)?.path).toBe(store.pagePath('chat-1', visual.id));
    });

    test('keeps the order of publishing, the maximum height and the measured heights ascending by width', async () => {
        const first = await store.publish('chat-1', { title: 'A', html: PAGE, maxHeight: 480.4 });
        const second = await store.publish('chat-1', {
            title: 'B',
            html: PAGE,
            heights: [
                [800, 300.2],
                [320, 610],
                [800, 280],
                [0.3, 900.1]
            ]
        });
        expect(first.maxHeight).toBe(480);
        expect(second.heights).toEqual([
            [1, 901],
            [320, 610],
            [800, 280]
        ]);
        expect((await store.list('chat-1')).map((visual) => [visual.title, visual.at])).toEqual([
            ['A', 1000],
            ['B', 1001]
        ]);
    });

    test('refuses what breaks a limit, saying what to change, and writes nothing', async () => {
        const cases: Array<[Parameters<VisualStore['publish']>[1], string, RegExp]> = [
            [{ title: '   ', html: PAGE }, 'visual-invalid', /needs a title/],
            [{ title: 't'.repeat(VISUAL_LIMITS.title + 1), html: PAGE }, 'visual-invalid', /keep it to 200/],
            [{ title: 'A', html: '  ' }, 'visual-invalid', /self-contained HTML document/],
            [{ title: 'A', html: PAGE, maxHeight: 79 }, 'visual-invalid', /from 80 to 2000/],
            [{ title: 'A', html: PAGE, maxHeight: Number.NaN }, 'visual-invalid', /leave it out/],
            [{ title: 'A', html: PAGE, heights: [[0, 100]] }, 'visual-invalid', /positive width/],
            [
                { title: 'A', html: PAGE, heights: Array.from({ length: 25 }, (_value, index): [number, number] => [index + 1, 100]) },
                'visual-invalid',
                /at most 24/
            ],
            [{ title: 'A', html: 'x'.repeat(VISUAL_LIMITS.bytes + 1) }, 'visual-too-large', /at most 16\.0 MiB; load libraries from a public CDN URL/]
        ];
        for (const [input, code, message] of cases) {
            await expect(store.publish('chat-1', input)).rejects.toMatchObject({ code, message: expect.stringMatching(message) });
        }
        // The bootstrap counts: a page just under the limit no longer fits once it has one.
        await expect(store.publish('chat-1', { title: 'A', html: 'x'.repeat(VISUAL_LIMITS.bytes - 10) })).rejects.toMatchObject({ code: 'visual-too-large' });
        expect(await store.list('chat-1')).toEqual([]);
        expect(told).toEqual([]);
        expect(await readdir(home)).toEqual([]);
    });

    test('removing a visual takes its page; one that is gone changes nothing, and the last leaves no file', async () => {
        const first = await store.publish('chat-1', { title: 'A', html: PAGE });
        const second = await store.publish('chat-1', { title: 'B', html: PAGE });
        expect(await store.remove('chat-1', first.id)).toEqual([second]);
        expect(await store.remove('chat-1', first.id)).toEqual([second]);
        expect(await readdir(join(home, 'attachments', 'chat-1'))).toEqual([`${second.id}.html`]);
        expect(store.attachment('chat-1', first.id)).toBeNull();
        expect(await store.remove('chat-1', second.id)).toEqual([]);
        expect(await readdir(join(home, 'chats'))).toEqual([]);
        expect(told.map((entry) => entry.visuals.map((visual) => visual.title))).toEqual([['A'], ['A', 'B'], ['B'], []]);
    });

    test('every change tells the whole list in the order it was written', async () => {
        const [first] = await Promise.all([store.publish('chat-1', { title: 'A', html: PAGE }), store.publish('chat-1', { title: 'B', html: PAGE })]);
        await store.remove('chat-1', first.id);
        expect(told.map((entry) => entry.visuals.map((visual) => visual.title))).toEqual([['A'], ['A', 'B'], ['B']]);
    });

    test('a fork gets pages of its own, and removing the original leaves them', async () => {
        const kept = await store.publish('chat-1', { title: 'A', html: PAGE, turnId: 'turn-1' });
        await store.publish('chat-1', { title: 'B', html: PAGE, turnId: 'turn-2' });
        const copied = await store.copyChat('chat-1', 'fork-1', (visual) => visual.turnId === 'turn-1');
        expect(copied).toEqual([kept]);
        expect(told.at(-1)).toEqual({ chatId: 'fork-1', visuals: [kept] });
        await attachments.removeAll('chat-1');
        await store.removeChat('chat-1');
        expect(await readFile(store.pagePath('fork-1', kept.id), 'utf8')).toContain('<svg></svg>');
        expect(store.attachment('fork-1', kept.id)?.path).toBe(store.pagePath('fork-1', kept.id));
        expect(await store.list('fork-1')).toEqual([kept]);
    });

    test('a fork without a filter takes every visual whose page is still there', async () => {
        const first = await store.publish('chat-1', { title: 'A', html: PAGE });
        const second = await store.publish('chat-1', { title: 'B', html: PAGE });
        await rm(store.pagePath('chat-1', first.id));
        expect(await store.copyChat('chat-1', 'fork-1')).toEqual([second]);
        expect(await store.copyChat('chat-2', 'fork-2')).toEqual([]);
    });

    test('removing a chat drops its list and pages and says the list is empty; a chat without one tells nobody', async () => {
        const visual = await store.publish('chat-1', { title: 'A', html: PAGE });
        await store.removeChat('chat-1');
        await store.removeChat('chat-2');
        expect(await store.list('chat-1')).toEqual([]);
        expect(await readdir(join(home, 'attachments', 'chat-1'))).toEqual([]);
        expect(store.attachment('chat-1', visual.id)).toBeNull();
        expect(told.map((entry) => [entry.chatId, entry.visuals.length])).toEqual([
            ['chat-1', 1],
            ['chat-1', 0]
        ]);
    });

    test('a list that does not parse is refused rather than read as empty, and goes with its chat', async () => {
        await store.publish('chat-1', { title: 'A', html: PAGE });
        await writeFile(join(home, 'chats', visualFileName('chat-1')), JSON.stringify({ version: 1, visuals: [{ id: '' }] }));
        await expect(store.list('chat-1')).rejects.toThrow('not valid');
        await expect(store.publish('chat-1', { title: 'B', html: PAGE })).rejects.toThrow('not valid');
        await store.removeChat('chat-1');
        expect(await store.list('chat-1')).toEqual([]);
        expect(told.at(-1)).toEqual({ chatId: 'chat-1', visuals: [] });
    });

    test('a visuals file beside the records is no chat', async () => {
        await store.publish('chat-1', { title: 'A', html: PAGE });
        expect(isVisualFileName(visualFileName('chat-1'))).toBe(true);
        expect(await new ChatStore(home).list()).toEqual([]);
    });
});
