# Providers

A provider is one agent CLI: its models, its capabilities, how it starts and how it resumes a session. Two are built in.

| Provider    | Started as                                        | Config folder                               |
| ----------- | ------------------------------------------------- | ------------------------------------------- |
| Claude Code | `claude -p` with stream-json in and out           | `CLAUDE_CONFIG_DIR`, else `~/.claude`       |
| Codex       | `codex app-server`, JSON-RPC over stdio           | `CODEX_HOME`, else `~/.codex`               |

An agent that speaks the Agent Client Protocol becomes a provider from a spec (see [ACP agents](/agents/acp)).

The two differ. Claude Code reports a file change as before and after text and compacts by prompt. Codex reports unified diffs, streams tool output, compacts natively and has questions that can wait, but reports no cost and takes no reason with a denial. `provider.list` returns each one's [capabilities](/agent-contracts/providers-and-accounts#providers). Offer a control only when its capability is there.

## The registry

`ProviderRegistry` holds a host's providers, the built-ins by default.

| Method | Returns or does |
| --- | --- |
| `list()` | Each provider with whether it is installed and its version, cached for a minute |
| `invalidate(kind)` | Drops the cached detection of one |
| `kinds()` | The kinds it offers, in order |
| `get(kind)` | The provider, or a not-installed stand-in for an unknown kind |
| `oneShotProvider(preferred?)` | An installed CLI that answers a single prompt (used for titles), or `null` |
| `add(provider)`, `remove(kind)` | Offers or replaces a provider after start, or stops offering one |
| `onChange(listener)` | Calls the listener with the kind of every provider added, removed, or whose models or capabilities changed (`ChatProvider.onChange`). Returns an unsubscribe function. |

`AgentHost` and `wireAgents` always use the two built-ins. A host with other providers builds the registry, `ChatCore` and services itself.

## Models

Each provider has a `ModelCatalog`, shipped as `providers/<kind>-models.json`. The catalog completes a client's selection:

```ts
import { ModelCatalogDataSchema } from '@adecore/agent-contracts/model';
import { ModelCatalog } from '@adecore/agents/providers';

const catalog = new ModelCatalog(
    ModelCatalogDataSchema.parse({
        updatedAt: '2026-10-05T00:00:00Z',
        defaultModel: 'standard-model',
        profiles: {
            standard: {
                options: [{ id: 'effort', label: 'Effort', type: 'select', choices: [{ id: 'medium', label: 'Medium' }], defaultChoice: 'medium' }],
                contextWindowTokens: { '*': 200000 }
            }
        },
        models: [{ slug: 'standard-model', name: 'Standard', profile: 'standard', aliases: ['standard'] }]
    })
);

catalog.normalize({ model: 'standard', options: { effort: 'unknown', other: true } });
// { model: 'standard-model', options: { effort: 'medium' } }
```

`normalize` takes a slug or alias and falls back to the default model for an unknown one. It resets missing or invalid options to their default and drops options the model lacks. `resolveModel(name)` returns the slug, or `null` for an unknown name, for a caller that would rather refuse. `contextWindowFor(selection)` returns the context size or `null`. `replace(data)` takes a newer catalog, never an older one. `adopt(models, defaultModel, options)` takes the list, order and default an agent reported, keeping the catalog's name and profile for models it knows. A later `replace` keeps that list.

## Runtime modes

A chat's [runtime mode](/agent-contracts/providers-and-accounts#runtime-modes) becomes the CLI's own permission settings:

| Mode                | Claude Code `--permission-mode` | Codex approval policy and sandbox |
| ------------------- | ------------------------------- | --------------------------------- |
| `supervised`        | The CLI's default               | `untrusted`, `read-only`          |
| `auto-accept-edits` | `acceptEdits`                   | `untrusted`, `workspace-write`    |
| `auto`              | `auto`                          | `on-request`, `workspace-write`   |
| `full-access`       | `bypassPermissions`             | `never`, `danger-full-access`     |

The Codex column is the closest match, not an exact one. A new chat defaults to `full-access`, so name a mode, and narrow it in `runtimeModeFor` when the host has a ceiling. `MODE_ORDER` lists the modes narrowest first, and `narrowerMode(mode, ceiling)` returns the narrower of two. `ceilingForOpening(opener, requested)` refuses a mode wider than the opener's, for an agent that opens another.

`claude.allowedTools` lets Claude Code use the named tools without asking, in every mode. `codexRules` writes command prefixes Codex may run without asking into every Codex home. A home it cannot write to only costs an approval per call.

## Folders you do not trust

A CLI reads configuration from its working folder: settings with hooks and allow-lists, MCP servers, skills and commands. From an untrusted folder, that configuration can run commands outside the chat's runtime mode. Return `false` from `projectConfigFor(chatId)` for such a chat. The host asks before every turn, like `foldersFor`, and a change starts the next turn in a new process. Absent or `true` loads the configuration as usual.

Check `provider.ignoresProjectConfig` before you offer a provider for such a chat. A provider that cannot ignore it fails the turn with `project-config-unsupported`.

| Provider    | `ignoresProjectConfig` | What `projectConfig: false` does                                                                                                                                  |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `true`                 | Starts with `--setting-sources=user` and `--strict-mcp-config`. Project settings, `.mcp.json`, skills and commands stay out. The person's own settings (where a host installs its hooks) still load, but their MCP servers and connectors do not. A `CLAUDE.md` in the folder is still read. |
| Codex       | `false`                | Nothing. A folder's `.codex` layer loads once the person's config trusts the folder or repository, and worktrees inherit that trust. |

Measured on Claude Code 2.1.300 and Codex 0.162.1. A provider of your own sets `ignoresProjectConfig` when its backend honors `BackendLaunch.projectConfig`.

## A provider of your own

A `ChatProvider` is data plus a backend: `kind`, `name`, `catalog`, `capabilities`, `command`, `resumeCommand`, `home` for accounts, `detect`, the first-prompt and one-shot arguments, and `createBackend(launch, host)`. The `ChatBackend` owns the process, speaks the CLI's protocol, and reports `BackendEvent`s through `host.onEvent`. See [`chat/backend`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/chat/backend.ts) for the interface (exported from `@adecore/agents/chat`) and the built-ins as examples.

The optional `ChatBackend.steerTurn(input)` adds user input to the running turn without interrupting it. Resolve `true` only once the CLI accepted it, `false` only when no turn is active, and reject when the outcome is unknown.

`LineSplitter` from `@adecore/agents/chat` cuts stdout into frames. A line longer than `MAX_LINE_LENGTH` is dropped and reported as `failed`, and reading goes on.
