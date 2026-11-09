# Usage

The host reads what the CLIs cost from their transcripts, and how much of each plan is left from the CLIs themselves. It answers the `usage.*` requests of the [contracts](/agent-contracts/usage). `AgentHost` builds both services; this page covers what they read and how to build them yourself.

## Summaries

`UsageService` reads the CLIs' transcripts, keeps an index in the data folder, and answers `usage.summary` for a period in the viewer's time zone. `usage.subscribe` keeps it scanning while a client follows. Every cost is an estimate, and a model without a known price costs `null`. [Storage](/agents/storage#usage) covers the files it keeps.

The scanner reads Grok's per-session `usage.json` under `$GROK_HOME/sessions/` (default `~/.grok`) without counting a turn twice. Grok's own cost (`costUsdTicks`) wins over the price table. Grok has no plan reader, so it has no limits.

## Prices

Prices come from LiteLLM's price table at `LITELLM_URL`, or from the bundled snapshot `@adecore/agents/usage/prices-snapshot.json` when that cannot be fetched. Dollars convert to euros at the ECB reference rate from the Frankfurter API.

`AgentHost` fetches prices and rates when a page asks. A host that may not reach the network makes its own `UsageService` with `allowPriceFetch: false` and wires the handlers itself. The bundled table then prices everything.

## Plan limits

`UsageMonitor` periodically reads each plan's remaining share from the CLIs and merges what running turns report. It answers `usage.limits` and sends `usage.limitsChanged`. A full read of a plan holds the plan, its windows and the session cost. What a running turn reports in passing is a `LimitsUpdate`, a few windows of one CLI and account, which the core hands to `applyLive`.

A provider that can be asked has a `probeLimits(command, env)`, which `createClaudeProvider` and `createCodexProvider` set; the monitor reads the plan of every CLI whose provider has one, and of every provider the host answers for through `plans`.

The default account of every CLI is read every five minutes. Another account is read only while a chat or terminal used it in the last day since `start()`, or while a usage page is open: `watch(clientId)` and `unwatch(clientId)`, which `usage.subscribe` and `usage.unsubscribe` call and a client that goes releases. The first page to open reads those accounts at once, as far as their clock and backoff allow. Every read starts a CLI, so an account nobody uses is not read on the clock alone. With `file`, the monitor keeps the last numbers of every account there and shows them after a restart until its own read replaces them. `limitsFileIn(dataDir)` is the path `wireAgents` uses. `stop()` resolves once the last numbers are written.

For a provider with no CLI to ask, such as a subscription API the host calls with its own key, the host answers through `plans` with a `ProbeResult`, using `fraction` for each window's share. A plan function gets the `LimitAccount` it reads.

## Transcripts of other providers

Every provider other than Claude Code, Codex and Grok needs the host to log its calls, which the scanner reads like a transcript. An ACP agent can write that log itself (see [ACP agents](/agents/acp#usage)). `hostUsageLine` writes one call with the token kinds apart: `input`, `cacheRead`, `cacheWrite`, `output`, `reasoning`. Map your API's counts onto them, checking whether its input includes the cached part. Add a root for that folder, with its provider, to the `roots` of the `UsageService`.

A provider that runs Claude Code in a configuration folder of its own, such as one on an API key, needs no log. `claudeTranscriptRoot(provider, configDir)` is a root that reads Claude Code's transcripts there and counts them under `provider`. Its `format: 'claude'` tells the scanner how to read them.

A root is a `UsageRootPath`: a `provider`, a `path`, optionally the `accounts` whose CLI writes there, and the `format`. `usageRoots(env)` returns the roots of the default accounts, found through the variables the CLIs read.

## Building the services yourself

`AgentHost` and `wireAgents` build both services from the accounts. A host with its own wiring builds them the same way:

```ts
import { chatSessionAccounts, limitAccountsOf, limitsFileIn, UsageMonitor, UsageService, usageAccountsOf, usageRootsOf } from '@adecore/agents/usage';

const nameOf = (kind: string): string => providers.get(kind).name;

const limits = new UsageMonitor({
    providers,
    accounts: limitAccountsOf(accounts, nameOf, env),
    file: limitsFileIn(dataDir)
});
accounts.listen(() => limits.accountsChanged());

const usage = new UsageService({
    home: dataDir,
    allowPriceFetch: false,
    knownProjects: async () => projects.map(({ id, name, folder }) => ({ projectId: id, name, folder })),
    roots: () => usageRootsOf(accounts),
    sessionAccounts: () => chatSessionAccounts(chats.list()),
    accounts: () => usageAccountsOf(accounts, nameOf)
});
```

`providers` is the `ProviderRegistry`, `accounts` the `ProviderAccountsService` and `chats` the `ChatCore`.

| Helper | What it gives |
| --- | --- |
| `usageRootsOf(accounts)` | The transcript folders of every account the machine has. |
| `usageAccountsOf(accounts, nameOf)` | Every account the usage page may filter by, on or off, since what it spent still counts. |
| `limitAccountsOf(accounts, nameOf, env)` | The `LimitAccounts` the monitor reads: the default account of every CLI and every other one that is on and signed in. Each is a `LimitAccount`, and a probe runs in its `ProbeEnv`. |
| `chatSessionAccounts(chats)` | The account each CLI session of a chat ran under, for transcript folders that accounts share. |

`knownProjects` returns the projects your app knows, so the usage page shows a folder under your project's name. `UsageMonitorOptions` lists every option of the monitor. Hand both services to `usageHandlers(usage, limits)` from `@adecore/agents/host` to answer the requests.
