import { describe, expect, test } from 'bun:test';
import { flush, rig } from './chat-session.fixture.test.ts';

describe('a predicted next prompt', () => {
    test('is asked of the CLI only when the host turns it on', async () => {
        const off = rig();
        off.session.send('hello');
        await flush();

        const on = rig({ promptSuggestions: () => true });
        on.session.send('hello');
        await flush();

        expect(off.launched()?.promptSuggestions).toBeUndefined();
        expect(on.launched()?.promptSuggestions).toBe(true);
        await off.session.dispose();
        await on.session.dispose();
    });

    test('holds after a turn and clears once the next turn opens', async () => {
        const told: Array<string | null> = [];
        const run = rig({ onSuggestion: (suggestion) => told.push(suggestion) });
        run.session.send('write the tests');
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        run.event({ type: 'prompt.suggestion', text: 'run them' });

        expect(run.session.suggestion).toBe('run them');

        run.session.send('run them');
        await flush();

        expect(run.session.suggestion).toBeNull();
        expect(told).toEqual(['run them', null]);
        await run.session.dispose();
    });

    test('that arrives while a turn runs is dropped', async () => {
        const told: Array<string | null> = [];
        const run = rig({ onSuggestion: (suggestion) => told.push(suggestion) });
        run.session.send('write the tests');
        await flush();
        run.event({ type: 'prompt.suggestion', text: 'run them' });

        expect(run.session.suggestion).toBeNull();
        expect(told).toEqual([]);
        await run.session.dispose();
    });
});
