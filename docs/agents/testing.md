# Testing

With fakes, a host runs without a CLI, login or network. [Getting started](/agents/getting-started) is a complete example.

## Fakes

Every fake comes from `@adecore/agents/testing`, except `memoryPortPair()` from `@adecore/agents/host`. A host that never imports the testing entry never ships them.

| Export                          |                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `inProcess(cli)`                | A `spawn` that runs a fake CLI in the process. `started` lists every run.            |
| `fakeClaude`                    | Claude Code's stream-json protocol.                                                  |
| `fakeCodex`, `fakeCodexWith`    | Codex's app-server protocol, the second with options.                                |
| `fakeAcp`, `fakeAcpWith`        | An agent on the Agent Client Protocol, the second with options (`FakeAcpOptions`).   |
| `memoryPortPair()`              | Two ends of a `FramePort` in one process; a frame arrives as a copy, a moment later. |
| `ManualClock`                   | Time for the outbox that moves when you say.                                         |
| `FakeWatch`, `EventLog`         | File changes you raise yourself, and a log of events to wait on.                     |
| `testAccounts` | An account service with fake checks and secrets in memory.                                   |

For real pipes and exit codes, start `@adecore/agents/testing/bin/fake-claude` or `@adecore/agents/testing/bin/fake-codex` with `bun` in place of the CLI. `runOverStdio(cli)` does the same for a fake of your own. The captures the fakes follow are JSON under `@adecore/agents/testing/fixtures/`.

`fakeClaude` answers a message with `echo:` and its text. `slow` keeps the turn running so a test can stop it. `crash` and `crash loudly` end the process like a crash. [`fake-claude`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/testing/fake-claude.ts) and [`fake-codex`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/testing/fake-codex.ts) list the rest. Some of those write files or start a process, so read them first.

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

## Error codes

A refusal carries a code. Branch on the code and show the message.

| Code                                                     |                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `bad-request`, `unknown-request`                         | The frame, the name or the payload does not fit the protocol.                    |
| `chat-not-found`                                         | Create or load the chat first.                                                    |
| `chat-unreadable`                                        | Its record is from a version this one cannot read. It is left on disk.           |
| `chat-busy`                                              | A turn runs; wait, or ask for `force`.                                            |
| `request-not-found`                                      | The approval, question or queued message is no longer there: read the state again. |
| `history-expired`                                        | The cursor is gone; attach again.                                                 |
| `chat-unsupported`                                       | This host or this CLI does not do that.                                           |
| `project-config-unsupported`                             | `projectConfigFor` turned the folder's configuration off and this CLI cannot ignore it; the turn does not start. |
| `invalid-attachments`                                    | An attachment the host could not take.                                            |
| `account-unavailable`, `account-incompatible`, `invalid-account` | The account is not there, cannot take the chat over, or is not valid.     |
| `secrets-unavailable`                                    | No keychain on this machine.                                                      |
| `internal`                                               | Something else failed; the host logged it.                                        |

Others name what was not found (`subagent-not-found`, `task-not-found`, `turn-not-found`, `item-not-found`, `bookmark-not-found`), `too-many-bookmarks`, a visual that breaks a limit (`visual-invalid`, `visual-too-large`), and a CLI transcript that is missing or not readable (`transcript-missing`, `transcript-format`). [Context commands](/agents/context-commands#refusals) refuse in their own format.
