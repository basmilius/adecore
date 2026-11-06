import { describe, expect, test } from 'bun:test';
import { flush, rig } from './chat-session.fixture.test.ts';
import type { PromptNotes } from './chat-session.ts';

/* Notes that put the brief under a title among the rest, the way a host with a title of its own does. */
function titledNotes(): PromptNotes {
    return {
        next: (brief) => ({ shown: brief === undefined ? [] : [`Brief\n${brief}`], heard: [] }),
        reset: () => undefined
    };
}

describe('a brief for one prompt', () => {
    test('is said through the notes in front of a prompt and drawn as a note of that turn', async () => {
        const run = rig({ promptNotes: titledNotes() });
        const { turnId } = run.session.send('summarize main', { brief: 'publish it' });
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([['summarize main', 'Brief\npublish it']]);
        expect(run.session.thread.list().find((item) => item.kind === 'note')).toMatchObject({ turnId, text: 'Brief\npublish it' });
        await run.session.dispose();
    });

    test('is heard without notes of the host, and only on the prompt it came with', async () => {
        const run = rig();
        run.session.send('first', { brief: 'the brief' });
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        run.session.send('second');
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([
            ['first', 'the brief'],
            ['second', null]
        ]);
        await run.session.dispose();
    });

    test('rides after a slash command as its arguments, since a CLI reads nothing in front of one', async () => {
        const run = rig({ promptNotes: titledNotes() });
        run.session.send('/review', { brief: 'publish it' });
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([['/review\n\n---\npublish it', null]]);
        expect(run.session.thread.list().find((item) => item.kind === 'user')).toMatchObject({ text: '/review\n\n---\npublish it' });
        expect(run.session.thread.list().some((item) => item.kind === 'note')).toBe(false);
        await run.session.dispose();
    });

    test('waits in the queue with its message, never reaching another', async () => {
        const run = rig({ promptNotes: titledNotes() });
        run.session.send('busy');
        await flush();
        run.session.send('later', { brief: 'for later' });
        run.session.send('after that');
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([
            ['busy', null],
            ['later', 'Brief\nfor later'],
            ['after that', null]
        ]);
        await run.session.dispose();
    });

    test('goes with a wake, and a refused wake leaves it for nobody', async () => {
        const run = rig({ promptNotes: titledNotes() });
        run.session.send('start');
        await flush();

        expect(run.session.wake({ text: 'too soon', label: 'Morning', taskIds: [], brief: 'refused' })).toBeNull();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        expect(run.session.wake({ text: 'run again', label: 'Morning', taskIds: [], brief: 'the brief' })).not.toBeNull();
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        run.session.send('by hand');
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([
            ['start', null],
            ['run again', 'Brief\nthe brief'],
            ['by hand', null]
        ]);
        await run.session.dispose();
    });

    test('rides after a slash command of a wake too', async () => {
        const run = rig({ promptNotes: titledNotes() });
        run.session.wake({ text: '/review', label: 'Morning', taskIds: [], brief: 'publish it' });
        await flush();

        expect(run.sent.map((input) => input.text)).toEqual(['/review\n\n---\npublish it']);
        await run.session.dispose();
    });
});
