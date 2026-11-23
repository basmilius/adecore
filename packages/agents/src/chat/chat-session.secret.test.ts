import { describe, expect, test } from 'bun:test';
import type { ChatEvent } from '@adecore/agent-contracts';
import { flush, rig } from './chat-session.fixture.test.ts';

describe('the record of a request for a secret', () => {
    test('lands outside any turn while none runs, and is emitted and persisted', async () => {
        const emitted: ChatEvent[] = [];
        let persisted = 0;
        const run = rig({ emit: (event) => void emitted.push(event), persist: () => void (persisted += 1) });

        run.session.addSecret({ label: 'GitHub token', outcome: 'saved' });

        const item = run.session.thread.list().find((entry) => entry.kind === 'secret');
        expect(item).toMatchObject({ kind: 'secret', turnId: null, label: 'GitHub token', outcome: 'saved' });
        expect(item).not.toHaveProperty('fields');
        expect(emitted).toContainEqual(expect.objectContaining({ type: 'item', item }));
        expect(persisted).toBe(1);
        await run.session.dispose();
    });

    test('belongs to the turn that runs, names every value asked for and never reaches the CLI', async () => {
        const run = rig();
        const { turnId } = run.session.send('deploy it');
        await flush();

        run.session.addSecret({ label: 'Database', outcome: 'declined', fields: ['user', 'password'] });
        await flush();

        expect(run.session.thread.list().find((entry) => entry.kind === 'secret')).toMatchObject({ turnId, outcome: 'declined', fields: ['user', 'password'] });
        expect(run.sent.map((input) => input.text)).toEqual(['deploy it']);
        await run.session.dispose();
    });
});
