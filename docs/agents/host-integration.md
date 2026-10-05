# Host integration

`AgentHost.open(options)` loads account records before returning. By default it also starts account and plan-limit checks. `host.chats`, `providers`, `accounts`, `usage`, and `limits` expose the composed services. `host.close()` disconnects clients, stops clocks, writes chats, and disposes provider processes; repeated calls share its closing promise.

## Host options

| Option                                       | Behavior                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dataDir`                                    | Required storage root for chats, attachments, account settings, and usage                   |
| `env`                                        | Absent: filtered process environment. Explicit with no policy: already prepared environment |
| `environmentPolicy`                          | Apply additional environment filtering, including to an explicit `env`                      |
| `systemNote`                                 | Instructions at the start of each provider process                                          |
| `client`                                     | Codex client identity; also used by account checks                                          |
| `accountsHost`                               | Display name, reserved variable prefixes, and keychain namespace                            |
| `claude`                                     | `ClaudeBackendOptions`, currently `allowedTools`                                            |
| `codexRules`                                 | Host-chosen command-prefix rules installed in Codex config/account homes                    |
| `core`                                       | Factory receiving composed `ChatCoreOptions`; returns your subclass                         |
| `background`                                 | `AgentHost` only; defaults to true for scheduled account/limit checks                       |
| `command`, `codexCommand`, `spawn`, `detect` | Process/detection injection, including deterministic fakes                                  |

The `core` factory receives initialized providers, stores, accounts, and callbacks. Keep those options when extending the core so attachments, bookmarks, and account launch behavior remain wired.

## Supply admission and policy

This adapter checks a host-maintained allowlist of authorized folders and narrows the runtime mode. The allowlist is supplied by the consumer. Populate it with canonical paths after your filesystem permission checks.

```ts
import { resolve } from 'node:path';
import type { RuntimeMode } from '@adecore/agent-contracts';
import { ChatCore, type ChatCoreOptions } from '@adecore/agents/chat/chat-core';
import { ChatError } from '@adecore/agents/chat/errors';
import { narrowerMode } from '@adecore/agents/modes';

export class ProjectChats extends ChatCore {
    private readonly folders: ReadonlySet<string>;

    constructor(options: ChatCoreOptions, folders: ReadonlySet<string>) {
        super(options);
        this.folders = folders;
    }

    protected override async admit(_chatId: string, cwd: string): Promise<void> {
        if (!this.folders.has(resolve(cwd))) {
            throw new ChatError('host-folder-denied', 'This folder is not authorized by the host.');
        }
    }

    protected override runtimeModeFor(_chatId: string, mode: RuntimeMode): RuntimeMode {
        return narrowerMode(mode, 'supervised');
    }
}
```

Use `core: (options) => new ProjectChats(options, authorizedFolders)`. `resolve` normalizes lexical paths; it is not a symlink or filesystem ownership check. Your host's folder authorization must establish the canonical identity first. `admit` runs when a chat is created or loaded, including persisted chats. Operation-specific and caller-specific checks still belong before each request handler.

## ChatCore extension points

| Hooks                                                      | Consumer responsibility                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `instructionsFor`, `resumeNoteFor`, `foldersFor`, `envFor` | Process instructions, resumed-thread notes, extra folders, and environment injection |
| `promptNotesFor`, `referencesFor`                          | Consume host notices and resolve authorized chat references                          |
| `admit`, `runtimeModeFor`, `openingSelection`, `hiddenFor` | Folder admission, permission ceiling, model choice, and list visibility              |
| `opened`, `recordExtras`                                   | Rehydrate host state and persist extra fields beside the thread                      |
| `clearing`, `cleared`, `forgotten`, `removed`              | Host cleanup associated with clear/removal                                           |
| `broadcasted`                                              | Observe an event after observers and before thread clients                           |
| `endedAt`, `unownedReason`, `resumeWords`                  | Ownership and wording for restart recovery                                           |

The defaults admit every folder, keep the requested mode, add no extra folders/references/prompt notes, and retain no host extras. `instructionsFor` returns the configured system note; `resumeWords` supplies generic restart wording. Hooks do not receive client ids. Do not use them as a substitute for transport-level caller authorization.

`foldersFor` is asked before every turn. Changing its list starts a replacement process for the next turn and resumes the native thread, without cutting an active turn. Claude receives `--add-dir` entries. The Codex adapter does not map that list to additional filesystem read restrictions.

`ChatCoreOptions` also accepts checkpoints, skill discovery, title/subagent adapters, `onInterruptedRun`, and `limitResume`. `TurnCheckpoints` supplies `take`, `diff`, and `settle`; the package does not create Git checkpoints by itself. `PromptNotes.next()` returns separate `shown` and `heard` lines, and `reset()` clears its prompt state.

## Compose without a port

```ts
import { wireAgents, type AgentWiringOptions } from '@adecore/agents/host/wiring';
import type { AgentEvent } from '@adecore/agents/events';

export async function openAgentServices(options: AgentWiringOptions, send: (event: AgentEvent) => void) {
    const wiring = wireAgents(options);
    await wiring.accounts.load();
    const disconnect = wiring.connect('authorized-connection', send);
    wiring.start();
    return {
        wiring,
        async close(): Promise<void> {
            disconnect();
            await wiring.stop();
        }
    };
}
```

This function is a host-provided adapter. Call `accounts.load()` before accepting requests and start clocks only when desired. `wireAgents` has no `background` option; skip `start()` to leave scheduled checks off. Explicit account refresh, limit refresh, or usage requests can still perform work.

The default wiring has no task/message context endpoint and no placement operations. `chat.fork`, `chat.forkInfo`, `chat.summarize`, and `chat.continueOn` return `chat-unsupported`. A consumer using `wireAgents` can replace those handlers after supplying authorized placement, native transcript continuation, and filesystem adapters. Presence in the schema table alone does not implement them.

## Electron lifecycle

Run the backend in a utility process and keep the renderer limited to contracts/client code. The main process forks your bundled host entry, supplies the authorized data root, then transfers one end of a `MessageChannelMain` to that process and the other to the approved window/preload. Verify the requesting `webContents`, frame, and origin before transferring a port. One window connection should have its own host client lifetime.

A `MessagePortMain` adapter sends with `postMessage`, listens with `on('message', receive)` where the event has `data`, calls `start()`, and releases with `off('message', receive)`. The renderer's DOM adapter is on the [transport page](./transport#browser-message-port-adapter). Its message protocol is the same agent envelope on both ends.

The utility process owns `AgentHost.open`, connection release functions, and physical port cleanup. Initialize the host before accepting transferred connections. The main process owns the application channel names and the utility process's lifetime; Adecore registers neither.

During quit, keep the process alive long enough to await `host.close()`, then acknowledge completion and exit the utility process. The main process can defer its first quit event until that acknowledgement/exit arrives and permit the next quit. Add a bounded failure path in the consumer if the worker crashes or shutdown cannot complete. Exiting immediately after requesting close can lose persisted work and leave a provider process behind.
