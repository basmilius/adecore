import { describe, expect, test } from 'bun:test';
import type { TurnInput } from '../backends/backend.ts';
import { flush, rig } from './chat-session.fixture.test.ts';

/* Notes a host reads from the prompt's text: one for every `$own-` skill it names. */
function heardFromText(text: string): readonly string[] {
    return [...text.matchAll(/\$own-([a-z]+)/g)].map((found) => `Skill ${found[1]}`);
}

describe('notes a host reads from the prompt', () => {
    test('are heard in front of a sent prompt and drawn nowhere in the thread', async () => {
        const run = rig({ promptHeard: heardFromText });
        run.session.send('use $own-design here');
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([['use $own-design here', 'Skill design']]);
        expect(run.session.thread.list().some((item) => item.kind === 'note')).toBe(false);
        await run.session.dispose();
    });

    test('follow a queued prompt, a wake and a steer, and never a slash command', async () => {
        const run = rig({ promptHeard: heardFromText });
        const steered: TurnInput[] = [];

        run.backend.steerTurn = async (input) => {
            steered.push(input);

            return true;
        };

        run.session.send('/review $own-design');
        await flush();
        run.session.send('queued $own-plan');
        await run.session.sendInput('steer $own-steer', { delivery: 'steer' });
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        run.session.wake({ text: 'woken $own-wake', label: 'Morning', taskIds: [] });
        await flush();

        expect(run.sent.map((input) => [input.text, input.preamble])).toEqual([
            ['/review $own-design', null],
            ['queued $own-plan', 'Skill plan'],
            ['woken $own-wake', 'Skill wake']
        ]);
        expect(steered.map((input) => [input.text, input.preamble])).toEqual([['steer $own-steer', 'Skill steer']]);
        await run.session.dispose();
    });
});

describe("a host's own skills", () => {
    test('stay in the text and the thread but never reach the CLI as a skill, while a skill of the CLI does', async () => {
        const run = rig({ hostSkills: () => ['own-design'] });
        run.session.send('$own-design then $review', { skills: ['own-design', 'review'] });
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        run.session.wake({ text: 'again $own-design', label: 'Morning', taskIds: [], skills: ['own-design'] });
        await flush();

        expect(run.sent.map((input) => [input.text, input.skills])).toEqual([
            ['$own-design then $review', ['review']],
            ['again $own-design', []]
        ]);
        expect(run.session.thread.list().find((item) => item.kind === 'user')).toMatchObject({ skills: ['own-design', 'review'] });
        await run.session.dispose();
    });

    test('are sent as picked without a host that names any', async () => {
        const run = rig();
        run.session.send('$own-design', { skills: ['own-design'] });
        await flush();

        expect(run.sent.map((input) => input.skills)).toEqual([['own-design']]);
        await run.session.dispose();
    });
});
