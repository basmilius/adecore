import { describe, expect, test } from 'bun:test';
import { flush, info, rig } from './chat-session.fixture.test.ts';

describe('host-selected chat naming', () => {
    test('a generated policy without a generator keeps native naming available', async () => {
        const run = rig({ titlePolicy: () => 'generated' });
        run.session.send('Review a change');
        await flush();
        run.event({ type: 'title', title: 'Native title' });
        expect(run.session.info.suggestedTitle).toBe('Native title');
        await run.session.dispose();
    });

    test('the native default leaves Claude naming alone', async () => {
        let requests = 0;
        const run = rig({
            titlePolicy: () => 'native',
            nameThread: async () => {
                requests += 1;
                return 'Generated';
            }
        });
        run.session.send('Review a change');
        await flush();
        run.event({ type: 'title', title: 'Native title' });
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        expect(run.session.info.suggestedTitle).toBe('Native title');
        expect(requests).toBe(0);
        await run.session.dispose();
    });

    test('a CLI that names nothing itself is named under the native policy', async () => {
        const run = rig({ namedByOneShot: true, titlePolicy: () => 'native', nameThread: async () => 'One-shot title' });
        run.session.send('Review a change');
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        expect(run.session.info.suggestedTitle).toBe('One-shot title');
        await run.session.dispose();
    });

    test('an open chat follows the current policy and generated titles win over both native sources', async () => {
        let policy: 'native' | 'generated' = 'native';
        let reads = 0;
        const title = Promise.withResolvers<string | null>();
        const run = rig({
            titlePolicy: () => policy,
            readTitle: async () => {
                reads += 1;
                return 'Transcript title';
            },
            nameThread: () => title.promise
        });
        policy = 'generated';
        run.session.send('Review a change');
        await flush();
        run.event({ type: 'session', agentSessionId: 'native-session', model: null, title: 'Session title' });
        run.event({ type: 'title', title: 'Native title' });
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        expect(run.session.info.suggestedTitle).toBeUndefined();
        title.resolve('Chosen model title');
        await flush();
        run.event({ type: 'title', title: 'Later native title' });
        expect(run.session.info.suggestedTitle).toBe('Chosen model title');
        expect(reads).toBe(0);
        await run.session.dispose();
    });

    for (const failure of ['null', 'rejection'] as const) {
        test(`a ${failure} generation restores an already available native title without another writer`, async () => {
            let requests = 0;
            const run = rig({
                titlePolicy: () => 'generated',
                nameThread: async () => {
                    requests += 1;

                    if (failure === 'rejection') {
                        throw new Error('Unavailable');
                    }

                    return null;
                }
            });
            run.session.send('Review a change');
            await flush();
            run.event({ type: 'title', title: 'Native title' });
            run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
            await flush();
            expect(run.session.info.suggestedTitle).toBe('Native title');
            expect(requests).toBe(1);
            run.event({ type: 'title', title: 'New native title' });
            expect(run.session.info.suggestedTitle).toBe('New native title');
            await run.session.dispose();
        });
    }

    test('clearing before a backend session arrives rejects the stale title and permits fresh naming', async () => {
        const old = Promise.withResolvers<string | null>();
        let requests = 0;
        const run = rig({
            titlePolicy: () => 'generated',
            nameThread: () => (++requests === 1 ? old.promise : Promise.resolve('Fresh title'))
        });
        run.session.send('First conversation');
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        expect(run.session.info.agentSessionId).toBeNull();
        await run.session.clear(true);
        old.resolve('Stale title');
        await flush();
        expect(run.session.info.suggestedTitle).toBeUndefined();
        run.session.send('Next conversation');
        await flush();
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        expect(run.session.info.suggestedTitle).toBe('Fresh title');
        expect(requests).toBe(2);
        await run.session.dispose();
    });

    test('a transcript read started under native policy cannot overwrite a generated title', async () => {
        let policy: 'native' | 'generated' = 'native';
        const native = Promise.withResolvers<string | null>();
        const run = rig({ titlePolicy: () => policy, readTitle: () => native.promise, nameThread: async () => 'Selected title' });
        run.session.send('Review a change');
        await flush();
        run.event({ type: 'session', agentSessionId: 'native-session', model: null });
        policy = 'generated';
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        native.resolve('Old transcript title');
        await flush();
        expect(run.session.info.suggestedTitle).toBe('Selected title');
        await run.session.dispose();
    });

    test('an existing title survives generated policy without another request', async () => {
        let requests = 0;
        const run = rig({
            info: { ...info(), suggestedTitle: 'Existing title', agentSessionId: 'resumed' },
            titlePolicy: () => 'generated',
            nameThread: async () => {
                requests += 1;
                return 'Replacement';
            }
        });
        run.session.send('Continue');
        await flush();
        run.event({ type: 'title', title: 'Native replacement' });
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        expect(run.session.info.suggestedTitle).toBe('Existing title');
        expect(requests).toBe(0);
        await run.session.dispose();
    });

    for (const provider of ['claude', 'codex']) {
        test(`a resumed unnamed ${provider} chat accepts a later native title without starting a new writer`, async () => {
            let requests = 0;
            const run = rig({
                info: { ...info(), provider, agentSessionId: 'resumed' },
                titlePolicy: () => 'generated',
                nameThread: async () => {
                    requests += 1;
                    return 'Replacement';
                }
            });
            run.session.send('Continue');
            await flush();
            run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
            await flush();
            expect(requests).toBe(0);
            run.event({ type: 'session', agentSessionId: 'resumed', model: null, title: 'Recovered native title' });
            expect(run.session.info.suggestedTitle).toBe('Recovered native title');
            await run.session.dispose();
        });
    }
});

describe("a host's reading of a CLI's own title", () => {
    const cliTitle = (title: string): string => title.replace('Acme-design', 'Design');

    test('rewrites a title the CLI pushes as an event or with its session', async () => {
        const run = rig({ cliTitle });
        run.session.send('$acme-design a pricing page');
        await flush();
        run.event({ type: 'title', title: 'Acme-design pricing page' });
        expect(run.session.info.suggestedTitle).toBe('Design pricing page');
        run.event({ type: 'session', agentSessionId: 'native-session', model: null, title: 'Acme-design checkout' });
        expect(run.session.info.suggestedTitle).toBe('Design checkout');
        await run.session.dispose();
    });

    test('rewrites a title read from the transcript', async () => {
        const run = rig({ cliTitle, readTitle: async () => 'Acme-design onboarding' });
        run.session.send('$acme-design onboarding');
        await flush();
        run.event({ type: 'session', agentSessionId: 'native-session', model: null });
        await flush();
        expect(run.session.info.suggestedTitle).toBe('Design onboarding');
        await run.session.dispose();
    });

    test('rewrites a native title held back for a generated one that failed', async () => {
        const run = rig({ cliTitle, titlePolicy: () => 'generated', nameThread: async () => null });
        run.session.send('$acme-design a pricing page');
        await flush();
        run.event({ type: 'title', title: 'Acme-design pricing page' });
        run.event({ type: 'turn.done', state: 'done', costUsd: 0 });
        await flush();
        expect(run.session.info.suggestedTitle).toBe('Design pricing page');
        await run.session.dispose();
    });

    test('leaves the title as the CLI wrote it without the hook', async () => {
        const run = rig();
        run.session.send('$acme-design a pricing page');
        await flush();
        run.event({ type: 'title', title: 'Acme-design pricing page' });
        expect(run.session.info.suggestedTitle).toBe('Acme-design pricing page');
        await run.session.dispose();
    });
});
