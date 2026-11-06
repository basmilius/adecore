# Providers

A provider is one agent CLI: its models, its capabilities, how it starts and how it resumes a session. Two are built in.

| Provider    | Started as                                        | Config folder                               |
| ----------- | ------------------------------------------------- | ------------------------------------------- |
| Claude Code | `claude`, driven through the Claude Agent SDK     | `CLAUDE_CONFIG_DIR`, else `~/.claude`       |
| Codex       | `codex app-server`, JSON-RPC over stdio           | `CODEX_HOME`, else `~/.codex`               |

An agent that speaks the Agent Client Protocol becomes a provider from a spec (see [ACP agents](/agents/acp)).

The two differ. Claude Code reports a file change as before and after text and compacts by prompt. Codex reports unified diffs, streams tool output, compacts natively and has questions that can wait, but reports no cost and takes no reason with a denial. `provider.list` returns each one's [capabilities](/agent-contracts/providers#providers). Offer a control only when its capability is there.

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

`AgentHost` and `wireAgents` always use the two built-ins, made by `createClaudeProvider` and `createCodexProvider`. A host with other providers builds the registry, `ChatCore` and services itself. The registry's options are `ProviderRegistryOptions`, with the providers, the environment and a `detect`. The registry finds a CLI by `cliExecutable(provider)`: the provider's `executable`, else the first word of its `command`.

## What a provider describes

Everything one CLI does differently sits on its `ChatProvider`, so no other code asks for a kind by name:

| Field | What it says |
| --- | --- |
| `command`, `executable` | What a chat starts, and the CLI itself where the chat runs on a server of its own (Antigravity's `agy`). A test points `createClaudeProvider({ command })` (`ClaudeProviderOptions`) and `createCodexProvider({ client, command })` (`CodexProviderOptions`) at a fake. |
| `launch` | A `LaunchDecorator`: the host's additions to every launch, applied once where a backend is made: its MCP server, extra arguments. Each backend hands an MCP server to its CLI in the form the CLI reads. A server with a `tokenVariable` becomes a header with `${VAR}` for Claude Code, `-c` arguments for Codex and an inline header for an ACP agent. |
| `home`, `prepareHome` | The config folder variable, how an account signs in, whether an account is a shadow home, and what the host puts in an account's folder. |
| `askAccount`, `probeLimits` | Who is signed in, and what is left of the plan. |
| `claudeCode`, `subagentSource`, `titleFromOneShot`, `threads` | Whether the chats run Claude Code, where a subagent's conversation is read from (a `SubagentSource`: `claude-transcript` or `codex-thread`), whether the host asks a one-shot CLI for a name, and the thread calls of an app-server (`ProviderThreads`: `listItems` and `fork`, each asked of a `ThreadProcess` the host starts). A chat of a provider whose `capabilities.fork` is set forks through `threads.fork` when the provider has `threads`, and otherwise by the host cutting the CLI's transcript. |
| `terminal` | A `ProviderTerminal`: how a terminal starts the CLI: flags per runtime mode, the model flag, how an MCP server is loaded from the line, a note for a fresh start, and `prepare` for flags only a newer version takes. |
| `oneShotArgs`, `oneShotStdinArgs`, `leanOneShotArgs` | A single prompt, and the same run made short and cheap for a model asked for an answer alone. |

`createCodexProvider` requires the `client` that names the host to every app-server it opens: the chat's, the account check, the plan probe and the thread calls. It is given once, there; `wireAgents` is the one place that falls back to "Agents".

A provider finds its CLI with `detectCli(command, env?, spawn?, flags?)`, which asks for the version and returns a `CliDetection`, `{ installed, version }`. A missing binary is "not installed", never an error.

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

`normalize` takes a slug or alias and falls back to the default model for an unknown one. It resets missing or invalid options to their default and drops options the model lacks. `resolveModel(name)` returns the slug, or `null` for an unknown name, for a caller that would rather refuse. `contextWindowFor(selection)` returns the context size or `null`. `replace(data)` takes a newer catalog, never an older one. `adopt(models, defaultModel, options)` takes the list, order and default an agent reported, keeping the catalog's name and profile for models it knows. A later `replace` keeps that list. The constructor takes a `ModelCatalogInput`, which needs no date for a catalog that is never replaced.

## Runtime modes

A chat's [runtime mode](/agent-contracts/providers#runtime-modes) becomes the CLI's own permission settings:

| Mode                | Claude Code `--permission-mode` | Codex approval policy and sandbox |
| ------------------- | ------------------------------- | --------------------------------- |
| `supervised`        | The CLI's default               | `untrusted`, `read-only`          |
| `auto-accept-edits` | `acceptEdits`                   | `untrusted`, `workspace-write`    |
| `auto`              | `auto`                          | `on-request`, `workspace-write`   |
| `full-access`       | `bypassPermissions`             | `never`, `danger-full-access`     |

The Codex column is the closest match, not an exact one. A new chat defaults to `full-access`, so name a mode, and narrow it in `runtimeModeFor` when the host has a ceiling. `MODE_ORDER` lists the modes narrowest first, and `narrowerMode(mode, ceiling)` returns the narrower of two. `ceilingForOpening(opener, requested)` refuses a mode wider than the opener's, for an agent that opens another. `modeField` is the optional `mode` field of a tool that opens an agent, which accepts only those modes. `codexThreadOptions(mode)` returns the Codex approval policy and sandbox of a mode, and `codexServiceTier(selection)` the service tier a selection asks for, or `null` for the standard one.

`claude.allowedTools` lets Claude Code use the named tools without asking, in every mode. `codexRules` writes command prefixes Codex may run without asking into every Codex home. A home it cannot write to only costs an approval per call.

The rules are `CodexRules`, `{ app, commands }`. `codexRulesText(rules)` is the file they become, and `codexRulesPathIn(home, rules)` where it goes: the `rules` folder of a Codex home, named after `app`, so it never touches a person's own rules. `installCodexRules(path, rules)` writes the file and returns a `CodexRulesResult`, `unchanged` or `written`. `defaultCodexHome(env)` is `CODEX_HOME`, or `.codex` in the person's home.

## Claude Code through the Agent SDK

A Claude chat drives Claude Code through `@anthropic-ai/claude-agent-sdk`, a dependency of this package pinned to one version. The SDK starts the CLI the person installed, from `command`, with the command's own arguments right after the executable. Each server in the launch's `mcpServers` goes to the CLI, and one with `allowTools` is allowed as `mcp__<name>__*`. The system prompt goes over in the SDK's handshake, so it never lands on a command line.

`claude.entrypoint` names your app to the CLI as `CLAUDE_CODE_ENTRYPOINT`, on the person's sign-in and on an API key. Without it the SDK's `sdk-ts` stays. The host sets it in the process environment only, so an `env` the person put in their own Claude settings still wins.

On Stop, a message sent into the running turn that the CLI has not taken in yet goes back to the queue. With an SDK that lacks the call for this, such a message runs after the Stop.

### On an API key

`claude.apiKey` runs the same chats on an Anthropic API key instead of the person's own sign-in. It takes a `ClaudeApiKeyOptions`:

```ts
createClaudeProvider({
    apiKey: {
        key: () => readKey(),
        configDir: join(dataDir, 'claude-api')
    }
});
```

The host calls `key()` at every start, so a replaced key reaches the next process. The CLI gets it as `ANTHROPIC_API_KEY`, with `CLAUDE_CONFIG_DIR` set to `configDir` and `DISABLE_AUTOUPDATER`, `DISABLE_BUG_COMMAND`, `DISABLE_ERROR_REPORTING` and `DISABLE_TELEMETRY` set. The host leaves out every variable of its environment that could send the key or the prompts elsewhere: every `ANTHROPIC_*` variable (base URLs, auth tokens, custom headers), the `CLAUDE_CODE_USE_*` switches to another cloud with their `CLAUDE_CODE_SKIP_*_AUTH`, `CLAUDE_CODE_OAUTH_TOKEN` and `AWS_BEARER_TOKEN_BEDROCK`. No settings file loads, and no MCP server beyond the launch's `mcpServers`, whatever `projectConfigFor` says.

It runs on the CLI the person installed, like every other Claude chat, and never on the one the SDK bundles.

A provider whose chats run Claude Code carries `claudeCode`, a `ClaudeCodeRuntime`, whatever its `kind`. That is what makes a chat behave as Claude: the queue waits for the turn the CLI opens once its background work ended, and the host reads subagents, titles and the rows a closed process left from its transcripts. `createClaudeProvider` sets it, with `configDir` when it has an `apiKey`. A provider you assemble yourself under another kind copies it, `configDir` included, so the host reads its transcripts from that folder and not from `~/.claude`. For the usage page, add `claudeTranscriptRoot(kind, configDir)` to the roots (see [Accounts](/agents/accounts)).

## Grok, Copilot and Antigravity

These three ACP agents each have a factory: `createGrokProvider`, `createCopilotProvider` and `createAntigravityProvider`. Each provider runs a chat over ACP and starts as a terminal. The registry does not include them by default, so add the ones you offer:

```ts
import { copilotUsageDirectory, createAntigravityProvider, createCopilotProvider, createGrokProvider, ProviderRegistry } from '@adecore/agents/providers';

const client = {
    name: 'example',
    title: 'Example',
    version: '1.0.0'
};

const registry = new ProviderRegistry({
    providers: [
        createGrokProvider({
            client,
            launch: withOwnServer
        }),
        createCopilotProvider({
            client,
            launch: withOwnServer,
            usageLog: copilotUsageDirectory(dataDir)
        }),
        createAntigravityProvider({
            client,
            launch: withOwnServer,
            server: antigravityServer
        })
    ]
});
```

Every factory takes `AcpVendorOptions`. `client` is how your host names itself in `initialize`. `launch` runs on every launch before its backend starts, for example to add your MCP servers to `mcpServers`. `catalogStore` keeps the models an agent reported across a restart.

`CopilotProviderOptions` adds `usageLog`, the folder the provider writes each turn's usage to. Copilot keeps no usage file of its own, so add `copilotUsageDirectory(home)` to the usage roots too.

Antigravity's chat runs on a server installed apart from the `agy` CLI. `AntigravityProviderOptions.server` is an `AcpServerLaunch`: its `launch()` returns the server's command, or `null` while none is installed. Without an installed server the provider offers no chat and refuses to start one, but still runs as a terminal. An absent or `null` server keeps the chat capability, for a host that only reads what the CLI can do. `ANTIGRAVITY_CLI` is the executable a terminal starts, and `antigravityOneShotArgs(prompt)` gives the arguments for a single prompt to it.

The three start from the models in `providers/<kind>-models.json` (`shippedAgentCatalog(kind)`) and take the ones a session reports. `AGENT_DEFAULT_MODEL` leaves the choice to the agent: `agentModel(selection)` maps it to `null`, and `agentDefaultCatalog()` offers only that model. `GROK_MODES`, `COPILOT_MODES` and `ANTIGRAVITY_MODES` are their `AcpModeMap`s.

Grok signs in with `XAI_API_KEY` when the launch has it, and otherwise with the login `grok login` left (`grokAuthMethod(env)`). The host checks its accounts with `grok models`, which opens no session. `askGrokModels(command, env)` runs it and `readGrokModels(output)` turns the output into `GrokModels`. `adoptGrokModels(catalog, store, listed)` writes that list to the catalog and the store, and keeps the names, context windows and options a chat learned.

## A model API with no CLI

Some services sell models behind an API and ship no agent CLI. For one that speaks OpenAI's streamed `/chat/completions`, the host keeps the key and the models, and the package runs the chat:

```ts
import { createChatCompletionsBackend } from '@adecore/agents/chat';
import { createApiChatProvider, nanoGptVendorOf } from '@adecore/agents/providers';

const provider = createApiChatProvider({
    kind: 'example-api',
    name: 'Example',
    version: 'API key',
    service,
    createBackend: createChatCompletionsBackend({
        name: 'Example',
        url: 'https://api.example.com/v1',
        request: fetch,
        apiKey: () => service.apiKey,
        directory: () => join(dataDir, 'example-api'),
        catalog: service.catalog,
        supportsTools: (model) => service.supportsTools(model),
        toolRounds: () => ({
            roundsPerRun: 40,
            runs: 5
        }),
        httpError: (status) => new Error(`Example request failed (HTTP ${status}).`),
        onUsage: (usage) => usageLog.append(usage),
        hostTools: (launch, host) => ownTools(launch, host),
        words: {
            noKey: 'Add an Example API key.',
            unknownModel: 'Refresh the Example models.',
            disconnected: 'The Example key was removed.',
            failed: 'Example could not finish this turn.',
            approval: 'Example requests access to this project.'
        }
    })
});
```

`createApiChatProvider` takes `ApiChatProviderOptions`, among them an `ApiChatService`: the `catalog`, a `status()` with whether a key is set and how many models it brought, and `onChange`. The provider counts as installed once both are there, and runs only as a chat.

`createChatCompletionsBackend` takes a `ChatCompletionsSpec`. The API keeps no conversation, so the backend keeps the thread as `<session id>.json` in `directory()`. It writes the file after every step and reads it back on resume. A request goes to `<url>/chat/completions` with the key as a bearer token and follows no redirect. Every error the backend writes starts with `name`, and only an error that starts with it reaches the person. Any other failure ends the turn with `words.failed`, since a raw error can quote the key. Build `httpError(status)` from the status alone, and start its message with `name`. The `ChatCompletionsWords` are the sentences that tell a person what to do in your app.

The model gets project tools: list, read, search, edit and write files under the working folder, run a command (`/bin/sh`, PowerShell on Windows, 30 seconds, output clipped), and `ask_user`, which opens a question card. A file tool refuses paths outside the folder, symbolic links, hidden files and credential files. `supervised` asks before every tool, and `full-access` asks for none. `auto-accept-edits` and `auto` ask only for a command. A plain API has no classifier, so `auto` runs as `auto-accept-edits`. `ask_user` waits for the person in every mode. A model for which `supportsTools` answers `false` is offered no tools at all.

`toolRounds()` returns `ToolRounds`, read as each run starts. After `roundsPerRun` rounds of tool calls the chat sends itself a message to carry on, up to `runs` runs, then ends the turn with an error. `onUsage` gets a `ChatCompletionsUsage` for every request that reported its `ChatCompletionsTokens`: the prompt holds its cached part and the completion its reasoning, as the API counts them.

`hostTools(launch, host)` returns `ApiHostTools` offered beside the project tools, such as those of your own MCP server, or `null`. Each `ApiToolDefinition` is a name, a description and a JSON schema. A call to one of them runs without an approval card in every mode, so check each call where you answer it, and return an `ApiToolOutcome`. No host tool may take the name of a project tool in `API_TOOLS` (`read_file`, `write_file`, `run_command` and the rest): the turn fails rather than let it skip that tool's approval. `close()` runs when the backend is disposed.

`nanoGptVendorOf(slug)` names who made a NanoGPT model, for a picker that groups by vendor: the publisher before the slash under one spelling, else the family the slug starts with, else `Other`.

## An MCP server on a CLI's command line

A chat gets its servers through the launch's `mcpServers`. A CLI you start yourself, in a terminal or for a backend you assemble, takes an HTTP server as arguments instead. `cliMcpArgs(kind, server)` returns them for Claude Code, Codex and Copilot, and nothing for another CLI. The server is a `CliMcpServer`:

```ts
const server: CliMcpServer = {
    name: 'tools',
    url: 'http://127.0.0.1:4000/mcp',
    tokenVariable: 'TOOLS_TOKEN'
};

const args = [...cliMcpArgs('claude', server), ...cliMcpAllowArgs('claude', server.name)];
```

The CLI reads the bearer token from `tokenVariable` in its own environment, so set that variable on the process and keep the token off the line. For Codex the name becomes a key of its config, so it may hold only letters, digits, `_` and `-`; another name throws. `cliMcpHeaders(tokenVariable)` is the `Authorization` header that Claude Code and Copilot fill in that way, for a `ChatMcpServer` of a Claude chat.

`cliMcpAllowArgs(kind, name)` runs every tool of the server without asking, in every mode: `--allowedTools=mcp__<name>` for Claude Code and `--allow-tool=<name>` for Copilot. Codex gets them allowed in its `cliMcpArgs` already. Allow a server only when it checks each call itself.

## Folders you do not trust

A CLI reads configuration from its working folder: settings with hooks and allow-lists, MCP servers, skills and commands. From an untrusted folder, that configuration can run commands outside the chat's runtime mode. Return `false` from `projectConfigFor(chatId)` for such a chat. The host asks before every turn, like `foldersFor`, and a change starts the next turn in a new process. Absent or `true` loads the configuration as usual.

Check `provider.ignoresProjectConfig` before you offer a provider for such a chat. A provider that cannot ignore it fails the turn with `project-config-unsupported`.

| Provider    | `ignoresProjectConfig` | What `projectConfig: false` does                                                                                                                                  |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `true`                 | Starts with `--setting-sources=user` and `--strict-mcp-config`. Project settings, `.mcp.json`, skills and commands stay out. The person's own settings (where a host installs its hooks) still load, but their MCP servers and connectors do not. A `CLAUDE.md` in the folder is still read. |
| Codex       | `false`                | Nothing. A folder's `.codex` layer loads once the person's config trusts the folder or repository, and worktrees inherit that trust. |

Measured on Claude Code 2.1.300 and Codex 0.162.1. A provider of your own sets `ignoresProjectConfig` when its backend honors `BackendLaunch.projectConfig`.

## A provider of your own

A `ChatProvider` is data plus a backend: `kind`, `name`, `catalog`, `capabilities`, `command`, `resumeCommand`, `home` for accounts (a `ProviderHome`: the variable the CLI reads its folder from and the folder it uses without it), `detect`, the first-prompt and one-shot arguments, and `createBackend(launch, host)`. The `ChatBackend` owns the process, speaks the CLI's protocol, and reports `BackendEvent`s through `host.onEvent`. See [`backends/backend`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/backends/backend.ts) for the interface (exported from `@adecore/agents/chat`) and the built-ins as examples.

The optional `ChatBackend.steerTurn(input)` adds user input to the running turn without interrupting it. Resolve `true` only once the CLI accepted it, `false` only when no turn is active, and reject when the outcome is unknown.

A changed model, option or runtime mode applies when the next turn starts, as a new process would. With the optional `ChatBackend.reconfigure(change)`, a `BackendChange` of the selection and the mode, the session first asks the running process to take it. Resolve `true` once it took all of it, `false` for a new process. A change of account, working folder, folders or project configuration always starts a new one. The Claude backend changes the model, effort, fast mode and permission mode in place. It needs a new process for a context window that moves where the CLI compacts, and for full access in a process that was not started with it.

`LineSplitter` from `@adecore/agents/chat` cuts stdout into frames. It drops a line longer than `MAX_LINE_LENGTH`, reports it as `failed`, and reads on.
