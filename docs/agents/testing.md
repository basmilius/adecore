# Testing

With fakes, a host runs without a CLI, login or network. [Getting started](/agents/getting-started) is a complete example.

## Fakes

Every fake comes from `@adecore/agents/testing`, except `memoryPortPair()` from `@adecore/agents/host`. A host that never imports the testing entry never ships them.

| Export                          |                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `inProcess(cli)`                | A `spawn` that runs a fake CLI in the process. `started` lists every run.            |
| `fakeClaude`                    | Claude Code's stream-json protocol, the SDK's handshake included.                    |
| `fakeCodex`, `fakeCodexWith`    | Codex's app-server protocol, the second with options.                                |
| `fakeAcp`, `fakeAcpWith`        | An agent on the Agent Client Protocol, the second with options (`FakeAcpOptions`).   |
| `memoryPortPair()`              | Two ends of a `FramePort` in one process; a frame arrives as a copy, a moment later. |
| `ManualClock`                   | Time for the outbox that moves when you say.                                         |
| `FakeWatch`, `EventLog`         | File changes you raise yourself, and a log of events to wait on.                     |
| `testAccounts` | An account service with fake checks and secrets in memory.                                   |

For real pipes and exit codes, start `@adecore/agents/testing/bin/fake-claude` or `@adecore/agents/testing/bin/fake-codex` with `bun` in place of the CLI. `runOverStdio(cli)` does the same for a fake of your own. The captures the fakes follow are JSON under `@adecore/agents/testing/fixtures/`.

`fakeClaude` answers a message with `echo:` and its text. `slow` keeps the turn running so a test can stop it. `crash` and `crash loudly` end the process like a crash. [`fake-claude`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/testing/fake-claude.ts) and [`fake-codex`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/testing/fake-codex.ts) list the rest. Some of those write files or start a process, so read them first.

A fake of your own is a `FakeCli`: a function that gets a `FakeIo` in place of `process` (arguments, folder and output) and returns a `FakeProgram` that reads one line at a time. The same fake then runs in a test and as a child process. `inProcess(cli)` returns an `InProcessCli`, whose `started` lists a `StartedFake` per run. `FakeCodexOptions` are the options of `fakeCodexWith`. `fakeCodexForks` lists every thread fork a fake Codex was asked, and `FAKE_CHILD_STEPS` is how many steps an agent it spawns takes. `claudeStoppingOnResume(sessionIds, how)` is the Claude fake, except that resuming one of those sessions fails: as for a session without a transcript (`missing`), or by exiting on the first prompt (`exit`).

An `inProcess` run has `runLater()` for deferred work, `crash(code)` and `exited`. Wait on events, not time, and put a limit on every wait so a broken test fails instead of hanging:

```ts
import { FakeWatch } from '@adecore/agents/testing';
import { settled } from '@adecore/agents';

const seams = new FakeWatch();
let scans = 0;

const refresh = settled(seams, 100, () => {
    scans += 1;
});

refresh.nudge();
refresh.nudge();
await seams.settle();
refresh.stop();
```

That scans once. Close everything a test opened (host, clients, outbox worker, watches) and check that it closed. An answered request says nothing about what still runs.

