import { expect, test } from 'bun:test';
import { UiCompiler, compileUi } from './compiler.ts';
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
