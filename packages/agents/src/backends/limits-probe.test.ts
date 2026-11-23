import { expect, test } from 'bun:test';
import type { SpawnChatProcess } from '../chat-process.ts';
import { flush } from '../chat/chat-session.fixture.test.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeCodexWith, type FakeCodexOptions } from '../testing/fake-codex.ts';
import { ManualClock } from '../testing/manual-clock.ts';
import { DEFAULT_CODEX_CLIENT } from './codex-transport.ts';
import { probeCodex } from './limits-probe.ts';

const WINDOWS = { rateLimits: { limitId: 'codex', primary: { usedPercent: 40, windowDurationMins: 300, resetsAt: 1_800_000_000 }, secondary: null } };

/* The fake behind a spawn that records when the probe closed its input and what it signaled, in order. */
function recorded(options: FakeCodexOptions): { spawn: SpawnChatProcess; seen: string[]; fake: ReturnType<typeof inProcess> } {
    const fake = inProcess(fakeCodexWith(options));
    const seen: string[] = [];

    const spawn: SpawnChatProcess = (spawnOptions) => {
        const child = fake.spawn(spawnOptions);

        return {
            ...child,
            stdin: {
                write: (chunk) => child.stdin.write(chunk),
                flush: () => child.stdin.flush(),
                end: () => {
                    seen.push('end');

                    return child.stdin.end();
                }
            },
            kill: (signal) => {
                seen.push(signal);
                child.kill(signal);
            }
        };
    };

    return { spawn, seen, fake };
}

/* Moves the clock a poll at a time, so a timer set inside another fires as it would. */
async function pass(clock: ManualClock, ms: number): Promise<void> {
    for (let spent = 0; spent < ms; spent += 250) {
        clock.advance(250);
        await flush();
    }
}

test('a Codex that reads its limits in 5 seconds still gives a reading', async () => {
    const clock = new ManualClock();
    const fake = inProcess(fakeCodexWith({ rateLimitsRead: { late: true, result: WINDOWS } }));

    const probe = probeCodex(['codex', 'app-server'], {}, DEFAULT_CODEX_CLIENT, { spawn: fake.spawn, clock, groupAlive: () => false });
    await flush();
    clock.advance(5_000);
    fake.started[0]?.runLater();

    expect(await probe).toMatchObject({ windows: [expect.objectContaining({ id: 'primary', used: 0.4 })] });
});

test('the probe closes the input and signals nothing while the group empties within the bound', async () => {
    const clock = new ManualClock();
    const { spawn, seen } = recorded({ rateLimitsRead: { result: WINDOWS } });
    // What `initialize` started in the app-server's group, such as git over ssh, still runs.
    let running = true;
    let settled = false;

    const probe = probeCodex(['codex', 'app-server'], {}, DEFAULT_CODEX_CLIENT, { spawn, clock, groupAlive: () => running }).then((result) => {
        settled = true;

        return result;
    });

    await flush();
    await pass(clock, 5_000);
    expect(seen).toEqual(['end']);
    expect(settled).toBe(false);

    running = false;
    await pass(clock, 250);

    expect(await probe).toMatchObject({ windows: [expect.objectContaining({ id: 'primary' })] });
    expect(seen).toEqual(['end']);
});

test('the probe signals the group only once the bound passed with something still in it', async () => {
    const clock = new ManualClock();
    const { spawn, seen } = recorded({ rateLimitsRead: { result: WINDOWS } });

    const probe = probeCodex(['codex', 'app-server'], {}, DEFAULT_CODEX_CLIENT, { spawn, clock, groupAlive: () => true });
    await flush();
    await pass(clock, 9_750);
    expect(seen).toEqual(['end']);

    await pass(clock, 250);

    expect(await probe).toMatchObject({ windows: [expect.objectContaining({ id: 'primary' })] });
    expect(seen).toEqual(['end', 'SIGTERM']);
});

test.each([
    ['an API key', { account: { type: 'apiKey' }, requiresOpenaiAuth: true }, 'none'],
    ['Bedrock', { account: { type: 'amazonBedrock' }, requiresOpenaiAuth: false }, 'none'],
    ['a model provider that needs no OpenAI sign-in', { account: null, requiresOpenaiAuth: false }, 'none'],
    ['a ChatGPT sign-in', { account: { type: 'chatgpt', email: null, planType: 'plus' }, requiresOpenaiAuth: true }, 'windows']
])('an account on %s reads the windows Codex still answers only when it has a plan', async (_account, account, expected) => {
    const fake = inProcess(fakeCodexWith({ account, rateLimitsRead: { result: WINDOWS } }));

    const result = await probeCodex(['codex', 'app-server'], {}, DEFAULT_CODEX_CLIENT, {
        spawn: fake.spawn,
        clock: new ManualClock(),
        groupAlive: () => false
    });

    if (expected === 'none') {
        expect(result).toEqual({ unavailable: { reason: 'no-subscription', message: null } });
    } else {
        expect(result).toMatchObject({ windows: [expect.objectContaining({ id: 'primary', used: 0.4 })] });
    }
});
