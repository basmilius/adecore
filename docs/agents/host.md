# Host

`AgentHost` serves the chats of one data folder, with their CLIs, accounts and usage, over ports. `wireAgents` is the same without ports, for an app with its own wire.

```ts
import { AgentHost } from '@adecore/agents/host';

const host = await AgentHost.open({ dataDir });
const disconnect = host.connect(port);
```

`AgentHost.open(options)` reads the accounts. Unless `background` is `false`, it also starts periodic checks of sign-ins and plan limits. `host.chats`, `providers`, `accounts`, `usage` and `limits` are the services. `host.close()` drops every client, writes every thread and ends every CLI. It settles once they exited, and a second call returns the same promise.

## Options

| Option                                       |                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `dataDir`                                    | Where the chats, attachments, bookmarks, visuals, accounts and usage history go. See [Storage](/agents/storage). |
| `env`                                        | The environment the CLIs start in. Without it, this process's own, filtered by `cliEnvironment`.      |
| `environmentPolicy`                          | More to filter out. With it, a passed `env` is filtered too.                                          |
| `systemNote`                                 | What every agent is told once, at the start of its process.                                           |
| `client`                                     | How the host names itself to Codex.                                                                   |
| `accountsHost`                               | The host's name in refusals, the variable prefixes no account may set, and its keychain prefix. See [Accounts](/agents/accounts#secrets). |
| `claude`                                     | `{ allowedTools }`: tool patterns Claude Code may use without asking, in every mode.                  |
| `codexRules`                                 | Command prefixes Codex may run without asking, written to its rules in every Codex home.              |
| `core`                                       | Makes the `ChatCore` from the options a plain one would get, for a core of your own.                  |
| `background`                                 | `AgentHost` only. `true` by default.                                                                  |
| `command`, `codexCommand`, `spawn`, `detect` | What is started, how, and how a CLI is found. Tests point these at fakes.                             |

`allowedTools` and `codexRules` grant permissions, so tie them to what your app allows. Nothing is allowed by default.

## Clients

`host.connect(port)` serves one client over a [`FramePort`](/agent-contracts/protocol#frameport) and returns a disconnect function. A frame or payload that does not parse gets `bad-request`. An unknown name gets `unknown-request`. A coded error from a handler returns its code. Any other error returns `internal` and is logged.

A client gets every chat's status, the accounts, the limits, and the thread events of chats it attached. Disconnecting detaches its chats and usage page, and the chats go on. The port has no authentication, timeout or reconnect. Whoever hands the host a port has already decided who is on the other end.

## What a plain host refuses

A fork needs a place in the app, so a host that only runs chats answers `chat.fork`, `chat.forkInfo`, `chat.summarize` and `chat.continueOn` with `chat-unsupported`. It has no tasks or messages between chats either (see [Coordination](/agents/coordination)). An app with a place for forks replaces those handlers.

## wireAgents

```ts
import { wireAgents } from '@adecore/agents/host';

const wiring = wireAgents({ dataDir });
await wiring.accounts.load();
wiring.start();

const release = wiring.connect(clientId, (event) => socket.send({ type: 'event', event: event.event, payload: event.payload }));
const result = await wiring.handlers['chat.send'](payload, clientId);
```

`wiring.handlers` has a `(payload, clientId) => result` handler for every agent request. `connect(clientId, send)` streams one client its events until you call the returned function. A handler checks nothing itself, so your wire must validate the frame and payload and check who asks. Load the accounts before the first request. `start()` runs the periodic checks and `stop()` ends everything. `chatHandlers`, `accountHandlers` and `usageHandlers` are the three parts of `handlers`. `ClientSinks` is the per-client fan-out behind `connect`, and `WatchedSinks` the same for events that only go to clients that called `watch`.

## ChatCore

The chats are a `ChatCore`. A host adds what it knows through `ChatCoreOptions.hooks`, a `ChatCoreHooks` with every hook optional, and passes a factory as `core`:

```ts
import { resolve } from 'node:path';
import { ChatCore, type ChatCoreHooks, ChatError } from '@adecore/agents/chat';
import { narrowerMode } from '@adecore/agents/providers';

function projectHooks(folders: ReadonlySet<string>): ChatCoreHooks {
    return {
        admit: async (_chatId, cwd) => {
            if (!folders.has(resolve(cwd))) {
                throw new ChatError('folder-denied', 'This folder is not one of the projects.');
            }
        },
        runtimeModeFor: (_chatId, mode) => narrowerMode(mode, 'auto')
    };
}

const host = await AgentHost.open({ dataDir, core: (options) => new ChatCore({ ...options, hooks: projectHooks(projectFolders) }) });
```

`admit` runs on every create and load, from disk too. `resolve` only normalizes a path, so check what a folder really is before it goes in the set.

| Hook                                                           | What the host adds                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `admit(chatId, cwd)`                                           | Throws for a folder the chat may not work in.                                             |
| `runtimeModeFor(chatId, mode)`                                 | Narrows the mode a chat runs in, whatever its record or its client says.                  |
| `openingSelection(chatId, kind)`                               | The model a new chat starts on.                                                           |
| `openingAccount(chatId, kind, named)`                          | The account a new chat starts on, given the one its start named; throw an `AccountError` to refuse it. Undefined leaves it to the order of the accounts. |
| `instructionsFor`, `resumeNoteFor`, `resumeInstructionsFor`    | What an agent is told at process start, before a resumed thread, and as new instructions to a thread that keeps its first. |
| `foldersFor(chatId)`                                           | Extra folders beside the working folder. Asked before every turn, and a change starts a new process. Claude Code gets them as `--add-dir`. |
| `projectConfigFor(chatId)`                                     | `false` runs the chat's CLI without the configuration of its working folder; see [Folders you do not trust](/agents/providers#folders-you-do-not-trust). |
| `envFor(chatId, base)`                                         | The environment of the chat's CLI before its account adds its own.                        |
| `promptNotesFor`, `referencesFor`                              | Notes in front of the next prompt, and how chats a message points at are named to the agent. |
| `hiddenFor(chatId)`                                            | Leaves the chat out of every list.                                                         |
| `opened`, `recordExtras`                                       | What the host lays down in a loaded chat, and keeps in its record beside the thread.     |
| `clearing`, `cleared`, `forgotten`, `removed`, `broadcasted`   | What goes along with a clear or a removal, and a look at every event.                     |
| `endedAt`, `unownedReason`, `resumeWords`                      | Taking up a turn the host went down in; see [Restarts](/agents/chats#restarts).           |

No hook knows the client. Checking who asks belongs on the wire.

A subclass of `ChatCore` can add host methods and pass its hooks to `super` as arrow functions over its members. Threads, clients and writes stay private. A subclass uses the public methods:

| Method                                          | What a host does with it                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `get(chatId)`, `isLoading(chatId)`              | The loaded chat, and whether a create of it is under way.                                   |
| `readChat(chatId)`, `hasStored(chatId)`         | A chat as it stands in memory or on disk, and whether it has a record.                     |
| `history(chatId, cursor?, limit?)`              | A page of a loaded chat's thread, the newest without a cursor.                              |
| `writeRecord(chatId, info, items, preambles?)`  | Writes the whole record of a chat nobody loaded, such as a fork, with its files copied over. |
| `deleteRecord(chatId)`                          | Removes what a chat nobody loaded keeps on disk; false for a loaded one, which `kill` removes. |
| `sendTo(clientId, event)`                       | Sends one client an event of the host's own.                                                |

`ChatCoreOptions` also takes `checkpoints`, `skills`, `onInterruptedRun` and `limitResume`. `checkpoints` is a `TurnCheckpoints` with `take`, `diff` and `settle` for a tree per turn. Its optional `head` records the commit at turn start and end, so a card can show that the branch moved. Without `checkpoints` a turn has none. The package runs no git itself.

## Electron

Run the host in a utility process and keep the window to the contracts and views. The main process starts the utility process with the data folder and makes a `MessageChannelMain` per window. After it checked which window and frame asked, it hands one port to the utility process and the other to the window. The utility process wraps its `MessagePortMain` as a `FramePort` (`postMessage` to send, `on('message')` with `{ data }` to receive, `start()`), calls `host.connect`, and disconnects when the window goes.

On quit, wait for `host.close()` before the utility process exits, so threads are written and no CLI is left behind. Give it a time limit in case it hangs. The channel names and window checks are your app's. The package registers none.
