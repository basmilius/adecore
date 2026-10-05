# Testing and troubleshooting

Test transport/state lifetimes with injected providers and temporary storage. `inProcess(fakeClaude)` and `inProcess(fakeCodex)` implement `SpawnChatProcess` without real child CLIs. Pass their `spawn`, inject provider detection, set a fixture environment, turn background checks off, and disable one-shot title generation in the test core as shown in [getting started](./getting-started).

## Deterministic fakes

| Helper                                          | Purpose                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `chat/fake-cli`: `inProcess`                    | Fake stdin/stdout/stderr and process exit; `started` exposes each run   |
| `chat/fake-claude`: `fakeClaude`                | Claude stream-json fixture                                              |
| `chat/fake-codex`: `fakeCodex`, `fakeCodexWith` | Codex app-server fixture with optional resume wording                   |
| `host/memory-port`: `memoryPortPair`            | Asynchronous structured-clone frame delivery in process                 |
| `outbox/manual-clock`: `ManualClock`            | Advance durable-work timers explicitly                                  |
| `watch-test-helpers`: `FakeWatch`, `EventLog`   | Emit watch changes, settle scheduled work, and wait for observed events |
| `providers/accounts/test-accounts`              | Account service fixtures with fake probing and secret storage           |

Useful fake prompts include ordinary text for an echo, `slow` for a running turn to interrupt, `crash`/`crash loudly` for exit/error-tail handling, and Claude's `compact` prompt for compaction. Read the [fake Claude](https://github.com/basmilius/adecore/blob/main/packages/agents/src/chat/fake-claude.ts) and [fake Codex](https://github.com/basmilius/adecore/blob/main/packages/agents/src/chat/fake-codex.ts) definitions for specialized approval/question/background prompts. Some specialized fake commands deliberately write files or spawn a grandchild; keep those out of general documentation checks.

`started.runLater()` performs work the fake deferred; it does not move wall-clock time. `started.crash(code)` ends a run and `started.exited` awaits the consumed exit. Use `EventLog.until` or matching protocol events instead of arbitrary sleeps. Bound a verification wait so a failed event cannot hang a test.

```ts
import { FakeWatch } from '@adecore/agents/watch-test-helpers';
import { settled } from '@adecore/agents/watch-seam';

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

This performs one scan. Closing clients, host processes, task clocks, outbox workers, and native transcript watches is part of the check; a successful response alone does not establish cleanup.

## Existing checks

Build contracts first, then use the agents package's `typecheck`, `test`, and `build` scripts. The [agent port example](https://github.com/basmilius/adecore/tree/main/examples/agent-port) exercises host, transport, React client, scope, and locales in source and compiled Node modes. The repository's pack validation checks export targets and external Node/Bun execution. Run provider integration tests only when intentionally testing an installed CLI; fake-based examples need none.

`boundary.test.ts` checks that non-test backend sources use Node-compatible APIs and import no application modules. It does not prove every provider works on every OS. Deployment checks must cover executable discovery, login, native process shutdown, and your authorized filesystem/transport adapters.

## Error responses

| Code                                                             | Caller response                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `bad-request`, `unknown-request`                                 | Fix envelope/name/payload; inspect the protocol table                  |
| `chat-not-found`                                                 | Create/load the chat before attach/send                                |
| `chat-unreadable`                                                | Keep the stored file intact; inspect its version/schema and backup     |
| `chat-busy`                                                      | Wait for the turn or obtain authorization for a forced operation       |
| `request-not-found`                                              | Refresh pending requests; another answer/settlement may have won       |
| `history-expired`                                                | Reattach and replace the local snapshot                                |
| `chat-unsupported`                                               | Supply a host handler or hide an unsupported action                    |
| `invalid-attachments`                                            | Check encoding, byte/count limits, and provider support                |
| `account-unavailable`, `account-incompatible`, `invalid-account` | Inspect state, folders, kind, and shared transcript compatibility      |
| `secrets-unavailable`                                            | Disable sensitive saves or compose a supported secret adapter          |
| `internal`                                                       | Inspect backend logs; the host intentionally returns a generic message |

Other domain errors include missing turns/subagents/tasks/bookmarks, bookmark count limits, and absent/malformed native transcripts. `CodedError` subclasses retain codes; arbitrary handler exceptions become `internal` at the port boundary. Context refusals use their own [tab-separated format](./context-commands#refusal-format).

## Common symptoms

If a chat opens but cannot send, inspect executable availability and account state. Detection alone does not authenticate. A resumed chat retains its provider/account/folder even if the create request supplies another.

If the thread appears duplicated after reconnect, handle a snapshot fallback as replacement and persist the last applied sequence. Do not append both replay deltas and a snapshot of the same text.

If a task never settles, inspect active turns, native background work, usage/overload pause, owed give-task work, and the outbox. `worker.settled()` can succeed while a future retry or `'wait'` entry remains. If an old task misses its parent wake after restart, call `recover()` before starting the worker.

If shutdown leaves activity, release application subscriptions, stop coordination clocks, and await `host.close()`. Confirm the platform supports your process-group termination assumptions. A timed-out request or detached client never implies a cancelled provider operation.
