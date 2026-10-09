import { expect, test } from 'bun:test';
import { UI_REPLY_LIMITS, UiCompiler, compileUi } from './compiler.ts';
import { UiStream, type UiStreamClock, type UiStreamPreview } from './stream.ts';

function manualClock(): UiStreamClock & { advance(ms: number): void; pending(): number } {
    let time = 0;
    let nextId = 0;
    const timers = new Map<number, { at: number; run(): void }>();
    return {
        now: () => time,
        setTimeout(run, ms) {
            const id = ++nextId;
            timers.set(id, { at: time + ms, run });
            return id;
        },
        clearTimeout(handle) {
            timers.delete(handle as number);
        },
        advance(ms) {
            const end = time + ms;
            while (true) {
                const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((left, right) => left[1].at - right[1].at)[0];
                if (!next) {
                    break;
                }
                time = next[1].at;
                timers.delete(next[0]);
                next[1].run();
            }
            time = end;
        },
        pending: () => timers.size
    };
}

function reply(label: string): string {
    return `Before\n\`\`\`ruimte-ui\n<Summary>${label}</Summary>\n\`\`\`\nAfter`;
}

test('reuses unchanged fences while compiling the growing block and authoritative final text', () => {
    const compiler = new UiCompiler({ id: 'item' });
    const first = compiler.compile(reply('First'));
    const secondText = reply('First') + '\n```ruimte-ui\n<Summary>Second';
    const second = compiler.compile(secondText);
    expect(second[0]).toBe(first[0]);
    expect(second[1].complete).toBe(false);
    const third = compiler.compile(secondText + ' grows');
    expect(third[0]).toBe(first[0]);
    expect(third[1]).not.toBe(second[1]);
    expect(third[1].nodes[0].id).toBe(second[1].nodes[0].id);
    const final = compiler.compile(secondText + ' grows', { final: true });
    expect(final[0]).not.toBe(first[0]);
    expect(final[1].complete).toBe(true);
    expect(final[1].diagnostics.map((item) => item.code)).toContain('unclosed_tag');
    expect(compiler.compile('No UI')).toEqual([]);
});

test('a changed generated attachment invalidates the cached image binding', () => {
    const compiler = new UiCompiler({ id: 'item' });
    const source = '```ruimte-ui\n<Image generated="latest" />\n```';
    const first = compiler.compile(source, { latestAttachment: 'first' });
    const second = compiler.compile(source, { latestAttachment: 'second' });
    expect(second[0]).not.toBe(first[0]);
    expect(first[0].nodes[0].props.attachment).toBe('first');
    expect(second[0].nodes[0].props.attachment).toBe('second');
});

test('final compilation diagnoses an unfinished fence even without a closing marker', () => {
    const source = '```ruimte-ui\n<Summary>Open';
    expect(compileUi(source, { id: 'item' })[0].diagnostics).toEqual([]);
    expect(compileUi(source, { id: 'item', final: true })[0].diagnostics.map((item) => item.code)).toContain('unclosed_tag');
});

test('continuous updates compile on a throttle and take the newest text without postponing the timer', () => {
    const clock = manualClock();
    const previews: Array<UiStreamPreview & { at: number }> = [];
    const stream = new UiStream({ id: 'item', clock, emit: (preview) => previews.push({ ...preview, at: clock.now() }) });
    stream.update(reply('0'));
    for (let i = 1; i <= 49; i++) {
        clock.advance(10);
        stream.update(reply(String(i)));
    }
    expect(previews.map((preview) => preview.at)).toEqual([0, 250]);
    expect(previews[1].blocks[0].fallback).toContain('24');
    expect(clock.pending()).toBe(1);
    clock.advance(10);
    expect(previews.map((preview) => preview.at)).toEqual([0, 250, 500]);
    expect(previews[2].textLength).toBe(reply('49').length);
    expect(previews[2].blocks[0].fallback).toContain('49');
});

test('finish uses authoritative text immediately and cancels a pending preview', () => {
    const clock = manualClock();
    const previews: UiStreamPreview[] = [];
    const stream = new UiStream({ id: 'item', clock, emit: (preview) => previews.push(preview) });
    stream.update(reply('Initial'));
    clock.advance(50);
    stream.update(reply('Pending'));
    const final = stream.finish(reply('Corrected'));
    expect(final[0].fallback).toContain('Corrected');
    expect(final[0].complete).toBe(true);
    expect(clock.pending()).toBe(0);
    clock.advance(1000);
    stream.update(reply('Late'));
    expect(previews).toHaveLength(1);
});

test('dispose cancels pending work and prevents late previews', () => {
    const clock = manualClock();
    const previews: UiStreamPreview[] = [];
    const stream = new UiStream({ id: 'item', clock, emit: (preview) => previews.push(preview) });
    stream.update(reply('Initial'));
    stream.update(reply('Pending'));
    stream.dispose();
    clock.advance(1000);
    stream.update(reply('Late'));
    expect(clock.pending()).toBe(0);
    expect(previews).toHaveLength(1);
});

test('reply block quotas keep later fences as text and never retain an unbounded cache', () => {
    const compiler = new UiCompiler({ id: 'item', now: () => 0 });
    const text = Array.from({ length: 100 }, (_, index) => reply(String(index))).join('\n');
    const blocks = compiler.compile(text);
    expect(blocks).toHaveLength(UI_REPLY_LIMITS.blocks);
    expect(blocks.at(-1)!.diagnostics.map((diagnostic) => diagnostic.code)).toContain('budget_exceeded');
    expect(text.slice(blocks.at(-1)!.end)).toContain('<Summary>99</Summary>');
    const shorter = compiler.compile(reply('0'));
    expect(shorter).toHaveLength(1);
    expect(shorter[0].diagnostics).toEqual([]);
});

test('reply node quotas include cached blocks and refusals can recover after an edit', () => {
    const compiler = new UiCompiler({ id: 'item', now: () => 0 });
    const source = '<Tag>a</Tag>'.repeat(240);
    const fence = '```ruimte-ui\n' + source + '\n```\n';
    const text = fence.repeat(5);
    const first = compiler.compile(text);
    const second = compiler.compile(text);
    expect(first).toHaveLength(5);
    expect(first[0].nodes).toHaveLength(240);
    expect(first.at(-1)!.nodes).toEqual([]);
    expect(first.at(-1)!.diagnostics[0].code).toBe('budget_exceeded');
    expect(second[0]).toBe(first[0]);
    expect(second.at(-1)!.diagnostics[0].code).toBe('budget_exceeded');
    const recovered = compiler.compile(fence);
    expect(recovered[0].diagnostics).toEqual([]);
    expect(recovered[0].nodes).toHaveLength(240);
});

test('reply character quotas stop at one bounded refusal without dropping surrounding prose', () => {
    const compiler = new UiCompiler({ id: 'item', now: () => 0 });
    const fence = '```ruimte-ui\n' + ' '.repeat(65520) + '\n```\n';
    const blocks = compiler.compile(fence.repeat(8) + 'After');
    expect(blocks).toHaveLength(5);
    expect(blocks.at(-1)!.fallback.length).toBeLessThanOrEqual(4096);
    expect(blocks.at(-1)!.diagnostics[0].code).toBe('budget_exceeded');
    expect(blocks.at(-1)!.end).toBeLessThan((fence.repeat(8) + 'After').length);
});

test('fence scanning keeps UTF-16 ranges, CRLF lines and an unterminated final line', () => {
    const compiler = new UiCompiler({ id: 'item', now: () => 0 });
    const prefix = '🐇 Before\r\n```ts\r\n```ruimte-ui\r\n<Summary>Ignored</Summary>\r\n```\r\n';
    const source = '  ~~~~ruimte-ui\r\n<Summary>Visible</Summary>\r\n  ~~~~';
    const blocks = compiler.compile(prefix + source, { final: true });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe(prefix.length);
    expect(blocks[0].end).toBe(prefix.length + source.length);
    expect(blocks[0].fallback).toContain('Visible');
    expect(blocks[0].fallback).not.toContain('Ignored');
    expect(compiler.compile('')).toEqual([]);
});

test('an exhausted reply stops scanning later fences and preserves its bounded refusal', () => {
    const compiler = new UiCompiler({ id: 'item', now: () => 0 });
    const prefix = Array.from({ length: UI_REPLY_LIMITS.blocks + 1 }, (_, index) => reply(String(index))).join('\n');
    const before = compiler.compile(prefix);
    const after = compiler.compile(prefix + '\n' + '```ruimte-ui\n<Summary>Unscanned</Summary>\n```\n'.repeat(10000));
    expect(after).toEqual(before);
    expect(after.at(-1)!.diagnostics.at(-1)!.code).toBe('budget_exceeded');
});
