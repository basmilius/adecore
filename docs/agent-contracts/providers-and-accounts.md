# Providers and accounts

## Agent kinds

`AgentKindSchema` is open: lowercase letters, digits and hyphens, starting with a letter, at most `AGENT_KIND_MAX_LENGTH` characters. A host can offer its own CLI under a new kind, and older clients still read it. `KNOWN_AGENT_KINDS` lists the kinds this version names (`claude`, `codex`, `gemini`, `copilot`, `apple`), with the type `KnownAgentKind` and the guard `isKnownAgentKind`. `AgentKind` accepts any string and still autocompletes the known ones.

Whether a CLI opens as a chat, in a terminal or both is a capability of its provider. For a kind without its own mark or color, fall back to the provider's name from `provider.list`, a generic icon and its capabilities. `UsageProviderSchema` stays closed, as every usage provider needs a reader in code.

```ts
import { AgentKindSchema, isKnownAgentKind } from '@adecore/agent-contracts/agent';

AgentKindSchema.parse('grok'); // 'grok'
AgentKindSchema.safeParse('../grok').success; // false
isKnownAgentKind('grok'); // false
```

`AgentStatusSchema` is `running`, `needs-you`, `idle`, `error` or `exited`.

## Models

```ts
import { ModelCatalogDataSchema, ModelSelectionSchema } from '@adecore/agent-contracts/model';

const catalog = ModelCatalogDataSchema.parse({
    updatedAt: '2026-10-05T00:00:00Z',
    defaultModel: 'example-model',
    profiles: {
        standard: { options: [], contextWindowTokens: { '*': 32000 } }
    },
    models: [{ slug: 'example-model', name: 'Example model', profile: 'standard' }]
});

const selection = ModelSelectionSchema.parse({ model: catalog.defaultModel, options: {} });
```

A catalog holds one provider's models. A newer copy can replace the shipped one, and `updatedAt` orders them. The schema requires an ISO date and time, at least one model, a profile per model, and a default model from the list. A slug is lowercase letters, digits, dots, underscores and hyphens, never starting with a hyphen, as it goes on a command line. A profile holds its models' options and context size, per `contextWindow` option value or under `*`. The schema does not check that slugs and aliases are unique or that a `defaultChoice` exists.

`ModelSelection` is `{ model, options }`, with options as strings and booleans. Parsing checks the shape only, and the host's catalog normalizes it. `ModelInfo` is a model as `provider.list` describes it, with `options` as `ModelOptionDescriptor`s: a `select` with `choices` and a `defaultChoice`, or a `boolean` with a `defaultValue`.

## Providers

`ProviderInfo` is one CLI as `provider.list` reports it: `installed`, `version`, `models`, `defaultModel`, `capabilities` and `resumeCommand`. Draw a control only when its capability is there:

| Capability             |                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `chat`, `terminal`     | Where the CLI can open: as a chat, in a terminal, or both.                           |
| `hooks`                | The host reads the CLI's hooks; without them a terminal shows the session status only. |
| `streamsToolOutput`    | Output arrives while a tool call runs.                                               |
| `diffs`                | How a file change arrives: `unified`, `before-after` or `none`.                      |
| `attachments`, `mentions` | Whether a message may carry files and `@` paths.                                  |
| `denyReason`, `allowAlways` | Whether a denial carries a reason, and whether a rule can be remembered.        |
| `asyncQuestions`       | A question the person may leave while the turn goes on.                              |
| `steer`                | A message sent while a turn runs can join that turn; absent where it cannot.         |
| `compaction`           | Folding the context: `native`, as a prompt (`prompt`), or `none`.                    |
| `reportsCost`, `reportsContextWindow`, `reportsThinking` | What the CLI tells about a turn.                   |
| `slashCommands`        | Whether the CLI takes slash commands.                                                |
| `goals`                | How `/goal` reaches the CLI: calls that pause, resume and clear (`native`), the slash command only (`command`), or absent. |

`install` tells a person how to get a CLI that is not installed, for an install page such as the one in the [providers pane](/agents-react/providers/providers-pane#install-page). It is absent when the host knows no way.

| Field         |                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `description` | One line on what the CLI is.                                                                      |
| `commands`    | One command per `ProviderPlatform` (`darwin`, `linux`, `win32`). Leave out a system without a one-line install. |
| `guideUrl`    | The CLI's own install guide, optional.                                                            |
| `signIn`      | The ways it signs in, preferred first, each a `ProviderSignIn`: `{ kind: 'command', command }` runs in a terminal, `{ kind: 'env', variable }` is a key in the environment, `{ kind: 'chat' }` asks in the first chat. |

```ts
import { ProviderInstallSchema } from '@adecore/agent-contracts/model';

ProviderInstallSchema.parse({
    description: 'A coding agent in a terminal.',
    commands: { darwin: 'brew install example-cli', linux: 'curl -fsSL https://example.com/install.sh | sh' },
    signIn: [{ kind: 'command', command: 'example-cli login' }, { kind: 'env', variable: 'EXAMPLE_API_KEY' }]
});
```

`resumeCommandFor(template, sessionId, flags = [])` fills a `resumeCommand`. It shell-quotes the session id and puts the flags at `{flags}`. The flags go in unquoted, so quote any that come from outside.

```ts
import { resumeCommandFor } from '@adecore/agent-contracts/model';

resumeCommandFor('example-cli {flags} --resume {id}', "it's-1", ['--read-only']);
// example-cli --read-only --resume 'it'\''s-1'
```

`pickerGroupsOf(providers)` splits anything with a `kind` and `name` into `ProviderPickerGroups`, `{ frontier, others, api }`, each sorted by name. A picker lists them in that order, with separators between nonempty groups. `FRONTIER_PROVIDER_KINDS` holds the frontier kinds and `API_PROVIDER_KINDS` the providers billed per key. Every other kind goes in `others`. `providerGroupOf(kind)` returns one kind's `ProviderPickerGroup`, for drawing separators in an ordered list.

```ts
import { pickerGroupsOf } from '@adecore/agent-contracts/model';

const { frontier, others, api } = pickerGroupsOf(providers);
const ordered = [...frontier, ...others, ...api];
```

## Runtime modes

`RuntimeModeSchema` is a chat's permission policy, shared by every provider: `supervised`, `auto-accept-edits`, `auto` and `full-access`, narrowest first. Each host adapter maps it onto its CLI (see [Providers](/agents/providers#runtime-modes)). A chat keeps the requested mode in `runtimeMode` and the confirmed one in `effectiveRuntimeMode`. Show the second when present.

## Accounts

An account is one config folder of a CLI, passed through the variable the CLI reads it from. The person signs in with the CLI itself.

`ProviderAccountIdSchema` is a slug: a lowercase letter, then up to 63 lowercase letters, digits, underscores or hyphens. It is never a path. No account, or an id equal to the provider's kind, means the default account.

`ProviderAccount` is `{ kind, label?, color?, enabled?, home?, shadowHome?, env? }`. Absent `enabled` is on. `home` is the config folder (`~` allowed), absent on the default account. `shadowHome` is Codex only: a separate login folder that shares everything else with `home`. `kind` is a plain string, so records of unknown CLIs still parse and round-trip.

`ProviderAccountVariable` is `{ name, value, sensitive, valueRedacted? }`, set on the CLI's environment. The host never sends a sensitive value. It sends `value: ''` with `valueRedacted: true`, and saving that back keeps the stored secret. `secretsAvailable` on the snapshot says whether the host can store secrets.

`ProviderAccountStatus` is the CLI's last answer about an account, never stored. Its `state` is `checking`, `disabled`, `not-found`, `signed-out`, `ready`, `folder-missing`, `unavailable` or `failed`, with optional `email`, `plan`, `organization` and `message`. `transcripts` is where the account writes conversations. A chat can move only between accounts that share it.

| Request               | Payload and answer                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `accounts.list`       | The snapshot: `accounts`, `statuses`, `secretsAvailable?`, `loginCommands?` (the terminal sign-in command per CLI) and `chatLogins?` (kinds that sign in from a chat). |
| `accounts.save`       | The whole map. A missing id is removed, and its folder stays.                                          |
| `accounts.create`     | `{ kind, label, color? }`, with a trimmed label of 1 to 80 characters. Returns the snapshot and the new `id`. |
| `accounts.refresh`    | Asks every CLI again and answers when all did.                                                         |
| `accounts.watchLogin` | `{ id }`. Answers at once, then polls the CLI until the account is signed in.                          |

## Terminal agents

A CLI can also run in a terminal, where the host reads its hooks. These contracts live outside the agent tables:

- `AgentRequestSchema` (`AgentRequest`) is a terminal hook request: `id`, `source`, `kind` (`approval` or `question`), `toolName`, nullable `title`, `text` and `createdAt`. It reports the request. The terminal still owns the answer.
- `AgentInfo` is a terminal session: `kind`, `agentSessionId`, `transcriptPath`, `status`, optional `requests`, and `live`, false after a host restart when the session can only be resumed. `SessionStatusEvent` carries it per session.
- `AgentResumePayload` names a session to resume.
- `ApprovalRequest` is a permission the terminal agent waits on, with `choices` (`allow`, `remember`, `deny`) and an `expiresAt`. The CLI asks in its own prompt too, and the first answer wins. `SessionApprovalsEvent` carries a session's pending list. `ApprovalAnswerPayload` names the choice. `ApprovalAnswerResult.accepted` is false when the request had already settled.
- `ApprovalPreferencePayload` says whether a client wants these requests. A client that never sends it gets them.

`SuggestedTitleSchema` is a session title from the CLI, at most `SUGGESTED_TITLE_LIMIT` characters. A model wrote it, so show it as plain text. `SessionIdSchema` is a terminal session id, any nonempty string the client picks.
