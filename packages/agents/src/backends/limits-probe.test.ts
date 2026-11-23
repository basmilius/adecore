import { expect, test } from 'bun:test';
import { flush } from '../chat/chat-session.fixture.test.ts';
import { inProcess } from '../testing/fake-cli.ts';
import { fakeCodexWith } from '../testing/fake-codex.ts';
import { ManualClock } from '../testing/manual-clock.ts';
import { DEFAULT_CODEX_CLIENT } from './codex-transport.ts';
import { probeCodex } from './limits-probe.ts';

test('a Codex that reads its limits in 5 seconds still gives a reading', async () => {
    const clock = new ManualClock();

    const fake = inProcess(
        fakeCodexWith({
            rateLimitsRead: {
                late: true,
                result: { rateLimits: { limitId: 'codex', primary: { usedPercent: 40, windowDurationMins: 300, resetsAt: 1_800_000_000 }, secondary: null } }
            }
        })
    );

    const probe = probeCodex(['codex', 'app-server'], {}, DEFAULT_CODEX_CLIENT, { spawn: fake.spawn, clock });
    await flush();
    clock.advance(5_000);
    fake.started[0]?.runLater();

    expect(await probe).toMatchObject({ windows: [expect.objectContaining({ id: 'primary', used: 0.4 })] });
});
