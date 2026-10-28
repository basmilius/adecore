# ACP agents

The [Agent Client Protocol](https://agentclientprotocol.com) is JSON-RPC 2.0 over an agent's stdio. Any agent that speaks version 1 becomes a provider through a spec, with no backend of its own. Chat, thread and wire work as for the built-in providers.

```ts
import { createAcpProvider, ModelCatalog } from '@adecore/agents/providers';

const exampleProvider = createAcpProvider({
    kind: 'example',
    name: 'Example',
    command: 'example',
    args: ['agent', 'stdio'],
    catalog: new ModelCatalog(exampleModels),
    modes: { supervised: ['default'], 'auto-accept-edits': ['accept-edits'], 'full-access': ['bypass'] },
    authMethod: 'api-key',
    loginHint: 'Run `example login` in a terminal.',
    capabilities: { reportsCost: true, reportsContextWindow: true }
});
```

Put it in the `ProviderRegistry` beside the others. A `kind` is any name the host picks.

## The spec

`AcpProviderSpec` is `AcpAgentSpec` (what the backend needs) plus the provider fields.

| Field | |
| --- | --- |
| `kind`, `name` | The provider's kind and its display name, also used in backend notes and errors. |
| `command`, `args` | The executable and arguments that start the ACP agent on its stdio. |
| `catalog` | The models a person picks from. The selection's slug is the agent's model id, unless `model(selection)` maps it. `null` leaves the choice to the agent. |
| `env` | Variables set over the launch environment. |
| `modes` | The agent's mode ids per runtime mode, best first (`AcpModeMap`). |
| `authMethod`, `loginHint` | The method passed to `authenticate` when the agent needs a login, and the error text when there is no method. |
| `client` | How the host names itself in `initialize` (`AcpClientInfo`). |
| `onSession(info)` | What each session offers (`AcpSessionInfo`). |
| `onUsage(report)` | The tokens of every turn that reports them (`AcpUsageReport`), with session, folder and model. |
| `usageLog` | A folder to log those turns to. See [Usage](#usage). |
| `autoAllow(request)` | Answers a permission request without asking, in any runtime mode. See [Calls the host guards](#calls-the-host-guards). |
| `accountProbe` | `false` drops `askAccount`, so the host's own reader checks accounts. |
| `adoptModels` | `false` keeps `catalog` instead of adopting the models a session reports. |
| `catalogStore` | Persists what the agent reported, so a restarted host offers it at once (`AcpCatalogStore`). See [Models](#models). |
| `onCommands(commands)` | The session's slash commands, without the slash, each time the agent lists them. |
| `adoptTitles` | `true` takes the agent's session titles as the chat's suggested title. Absent leaves naming to the host. |
| `onContextReport()` | Called once per process, at the first `usage_update` that names the context window. |
| `capabilities` | Overrides on top of `ACP_CAPABILITIES` and what the agent showed (see [Capabilities](#capabilities)). |
| `resumeCommand`, `home`, `detect`, `oneShotArgs`, `oneShotStdinArgs`, `firstPromptArgs`, `enabled`, `ignoresProjectConfig` | As on any `ChatProvider`. Without `firstPromptArgs` the agent is chat only. Without `detect` the host runs `--version`. |

A host that builds its `ChatProvider` by hand uses `createAcpBackend(spec)` as its `createBackend`.

## A session

`start` runs `initialize` and opens the session before the first turn. Only protocol version 1 is accepted. The client advertises no file system or terminal and passes no MCP servers, so the agent uses its own tools.

A chat with an agent session to continue uses `session/resume` (if the agent advertises `sessionCapabilities.resume`) or `session/load` (if it advertises `loadSession`). The history a load replays is dropped, as the thread already holds it. If the agent supports neither or refuses, it gets a new session and the thread gets a note. `BackendLaunch.folders` go along as `additionalDirectories` when the agent supports them.

ACP has no system prompt. The launch's `instructions` go before the first prompt of a new session. `resumeInstructions` and `resumeNote` go before the first prompt of a resumed one.

A prompt is one text block with attachments named by path. Images go as `image` blocks when the agent advertises `promptCapabilities.image`. With `promptCapabilities.embeddedContext`, small text files mentioned with `@` inside the chat's folders also go as `resource` blocks. Everything else stays a path for the agent to open.

When a session request answers that authentication is required, the backend calls `authenticate` with `authMethod` and retries once. Without a method, the start fails with `loginHint`.

## Modes

The runtime mode picks the first id in `modes` the agent offers, through `session/set_mode` or a `mode` config option. Without a matching id it falls to the next narrower runtime mode, down to `supervised`, never wider. The start fails if the agent already runs in a wider mode and offers nothing narrower.

The agent asks with `session/request_permission` for what its mode does not allow. The backend answers part of that itself, so every runtime mode holds:

| Runtime mode | Answered with allow once, without asking |
| --- | --- |
| `supervised` | Nothing |
| `auto-accept-edits` | Tool kinds `read`, `search`, `think`, `edit`, `move` |
| `auto` | The same, and `fetch` |
| `full-access` | Everything |

Everything else becomes an approval in the thread.

## Calls the host guards

A host that checks some calls itself, such as its own command line tool, passes `autoAllow`. The backend calls it for every permission request the runtime mode leaves open, with an `AcpPermissionRequest`: the tool `kind`, the `title`, and in `commands` every text the call may run. True answers with allow once (never allow always), and the call shows in the thread without an approval. False or a throw leaves it to the person.

`isOnlyCommands(command, allowed)` from `@adecore/agents/providers` returns true when a command line is only simple commands joined by `&&`, `||`, `;` or newlines, each starting with a word in `allowed`. It reads quotes and escapes as a shell does. Anything it cannot prove simple returns false, such as pipes, redirects, substitutions, subshells, `&`, globs and unbalanced quotes.

```ts
const spec: AcpProviderSpec = {
    // ...
    autoAllow: (request) => request.kind === 'execute' && request.commands.length > 0 && request.commands.every((command) => isOnlyCommands(command, ['my-tool', 'echo']))
};
```

## Turns, approvals and cancels

A turn is one `session/prompt` and ends on its response. `stopReason` maps onto the turn:

| `stopReason` | Turn |
| --- | --- |
| `end_turn` | Done |
| `cancelled` | Aborted after `interrupt`, else done |
| `max_tokens`, `max_turn_requests` | Done, with a warning note |
| `refusal` | Error |

A failed request ends the turn as an error and leaves the process running.

ACP defines no limits. The backend recognizes these agent-specific reports and ends the turn as an error with a `limit`:

| Agent | What it sends | `limit` |
| --- | --- | --- |
| Grok CLI | `session/prompt` fails with `-32003` whose data names `subscription:free-usage-exhausted` | `usage`, without a reset |
| Grok CLI | `session/prompt` fails with `-32003` otherwise (a 429 after its own retry) | `overload` |
| Grok CLI | `session/prompt` fails with `-32603` and `http_status` 529, a 5xx that says overloaded, or the stream error `overloaded_error` or `service_unavailable_error` | `overload` |
| Antigravity | A message that starts `Usage Limit Reached`, then `end_turn` | `usage`, with the reset the message names. The message becomes the turn's error. |

Any other failure stays an error without a limit.

An approval offers allow, allow always (only when the agent has `allow_always`) and deny. They map to the agent's `allow_once`, `allow_always` and `reject_once` or `reject_always` options. A missing option falls to the narrower one. A denial without any reject option answers `cancelled`.

`interrupt` cancels every open permission request and question and sends `session/cancel`. The turn ends when the agent answers the prompt.

## Questions

Two agents ask questions outside the protocol. Both become a `question.requested`, answered with `respondQuestion` and turned down with `declineRequest`:

- Grok CLI sends `_x.ai/ask_user_question`, with options and `multiSelect` per question.
- Antigravity asks one question per `session/request_permission`, on a tool call whose id starts with `interaction_`. It takes one choice only. A free-text answer turns the question down with a warning note. No runtime mode or `autoAllow` answers it.

## Updates

| `sessionUpdate` | Backend event |
| --- | --- |
| `agent_message_chunk` | `text.delta`, then one `text.done` per message. Images and resources are left out. |
| `agent_thought_chunk` | `thinking.delta` and `thinking.done` |
| `tool_call`, `tool_call_update` | `tool.started` on each change, `tool.done` once `completed` or `failed`. The kind names the row (`execute` is `Bash`, `read` is `Read`, `search` is `Grep`, `fetch` is `WebFetch` or `WebSearch`). A one-file diff draws as `Edit`, `Write` or `MultiEdit`, several files as unified changes. |
| `plan` | A `TodoWrite` row with the whole plan |
| `available_commands_update` | The chat's slash commands |
| `current_mode_update` | `permissions`, with the runtime mode that agent mode falls under |
| `config_option_update` | `model` and `permissions` for the model and mode options |
| `usage_update` | `usage` with the context tokens and window, and the cost when in USD |
| `session_info_update` | Ignored unless the spec sets `adoptTitles`. Then the `title`, cut to `SUGGESTED_TITLE_LIMIT`, becomes the suggested title. A title that only repeats the start of a sent prompt is left out. |

Other updates and unknown fields are ignored. Agent requests the backend does not handle, file system and terminal included, get "method not found".

## Models

`AcpSessionInfo.models` holds the models a session offers, from a `model` config option or the older `models` field. The backend switches through the option or `session/set_model`. A model the agent does not offer leaves the agent's own, with a note. `AcpSessionInfo.thoughtLevel` holds the reasoning effort as an `AcpThoughtLevel` with `AcpChoice` values. After the model, the backend sets the selection's `effort` when the agent offers that value for the model.

The provider adopts the models a session reports into its `catalog` (`ModelCatalog.adopt`). The agent's current model becomes the default, the rest follow in the agent's order and names. A reported reasoning effort becomes the profile's `effort` option, with the agent's current value as default. A session without models leaves the catalog as it was. Account checks open sessions too, so the list is usually there before the first chat. Set `adoptModels: false` to keep the host's catalog. `onSession` still sees every session.

The provider calls its `onChange` listeners when the models change. `ProviderRegistry.onChange` passes that on with the provider's kind, so a host can send clients the new list.

With `catalogStore` the provider saves what the agent reported on each change, and a new provider with the same store starts from it. `load()` returns what `save(value)` last got. The value only needs to survive as JSON. A store that throws only loses the cache.

```ts
const store: AcpCatalogStore = {
    load: () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null),
    save: (value) => writeFileSync(file, JSON.stringify(value))
};
```

## Capabilities

A provider starts from `ACP_CAPABILITIES` and adds what its agent showed in sessions and account checks. The spec's `capabilities` go on top. `catalogStore` keeps them with the models, and a change calls `onChange`. The object changes in place, so a copy of the provider still reads current values.

| The agent | Capability |
| --- | --- |
| Sends a `usage_update` with its context window | `reportsContextWindow: true` |
| Lists a `compact` command | `compaction: 'prompt'`: the chat sends `/compact` as a prompt, and so does the backend's `compact()` |
| Lists a `goal` command | `goals: 'command'`: the goal goes to the agent as `/goal` |

A list without `compact` sets `compaction` back to `none`. A model entry with `_meta.totalContextTokens` gets that size as its context window, so the meter has a size before the first `usage_update`.

## Usage

A `session/prompt` response may carry `usage`, an unstable part of the protocol. The backend reads it into `AcpTurnUsage`, with thought tokens as `reasoning` inside `output`. A cancelled turn still reports what it spent.

Every turn with usage goes to `onUsage`. With `usageLog`, the provider also appends a `hostUsageLine` per turn to a file per session in that folder. The host then adds a usage root for that folder under a provider in `USAGE_PROVIDERS` (such as `copilot`). An agent whose own usage files the scanner already reads (Grok) logs nothing, so no turn counts twice.

An agent without `usage_update` may send the context size in `_meta.totalTokens`, as Grok CLI does. The backend uses that as the context tokens until a `usage_update` arrives.

## Accounts

ACP cannot say who is signed in, so `askAcpAccount` opens a session to find out. It runs `initialize` and `session/new` in the account's environment, in an empty temporary folder. A session means signed in. The "authentication required" code (`-32000`) means signed out. Any other error, an exit or 20 seconds without answer fails the check. The probe never calls `authenticate`, which could start a login. It closes the session when the agent supports `session/close`, otherwise the agent may keep an empty session in its history. The session's offer goes to `onSession` and `onCommands`, as from a chat.

A reading carries no email or plan. `askAcpAccount` also takes a `spawn` and a `timer` (`ProbeTimer`) for tests.

## What it leaves out

Plan limits, file system and terminal client capabilities, MCP servers for the agent, `elicitation/create`, notices and compaction updates. `compaction` is `none` unless the agent lists a `compact` command.

`@adecore/agents/testing` has `fakeAcp`, an agent for backend tests, and `fakeAcpWith`, which can also require a login (`authMethod`), support `session/close` (`closeSession`), report `usage` per prompt (`turnUsage`), name context windows (`contextWindows`) or list slash commands (`commands`).
