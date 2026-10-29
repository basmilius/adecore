# Accounts and usage

## Accounts

An account is one config folder of a CLI plus the environment variables a person set for it. The person signs in with the CLI itself, and the host only asks the CLI who is signed in. Each offered CLI has a default account that uses the CLI's own folder, with the CLI's kind as id. The offered kinds come from the registry's `kinds()`, or from `KNOWN_AGENT_KINDS` when it returns none. Accounts of other kinds are kept but never checked.

`ProviderAccountsService` keeps a host's accounts. `AgentHost` exposes one as `host.accounts`. It answers the `accounts.*` requests, checks sign-ins periodically, and polls the CLI for a while after `accounts.watchLogin`. Accounts live in `providers.json` without secrets.

Under a non-default account, the host removes the variables that would sign the CLI in another way, points the CLI's folder variable at the account's folder, and adds the account's own variables. A chat can move only between accounts of the same CLI that share a conversation folder (`canContinue`). Otherwise the host fails with `account-incompatible`. An account it cannot start fails with `account-unavailable`.

A person orders the accounts of each CLI with `accounts.reorder`, which writes `order`. A start that names no account takes the top one that is on (`defaultFor`, `topAccountOf`). A host that gives a place its own default and turned-off accounts, such as a project, decides with `chooseAccount` in `ChatCoreHooks.openingAccount`: a named account the place turned off fails with `account-off-in-project`, and a preferred account that cannot take the start is passed over for the next usable one, with the reason in `passedOver`.

A CLI keeps accounts when its provider has a `home`: the folder variable, the default folder, the variables that sign it in by themselves, and the `loginCommand` a person types in a terminal. A CLI that signs in from its first chat, such as an ACP agent, leaves `loginCommand` out. Its kind appears in `chatLogins` instead of `loginCommands`, and its accounts count as `ready` without a check.

A provider with its own `askAccount(command, env)` is asked through it, as every ACP provider is (see [ACP agents](./acp#accounts)). Others go through the service's `ask`, which by default knows Claude Code (`claude auth status --json`) and Codex (`account/read`). A host's own `ask` must answer for every kind. A kind in `loginCommands` that nothing can ask is also listed in `silentLogins`, so a login window should not promise to close by itself.

`accounts.create` makes a folder for the new account under the data folder. For Codex it is a shadow home with its own `auth.json` and links to the shared home's sessions, skills and rules, so accounts continue each other's threads. A file already in the way is reported as not shared. This needs Codex to keep its login in a file, not the keychain.

## Secrets

A variable marked `sensitive` goes to the macOS login keychain, never to `providers.json`. On other platforms it fails with `secrets-unavailable`. Clients get it as `''` with `valueRedacted: true`, and saving that back keeps the stored value. A sensitive value holds printable ASCII only.

```ts
import type { AccountsHost } from '@adecore/agents/providers';

const accountsHost: AccountsHost = { name: 'My app', variablePrefixes: ['MYAPP_'], keychainPrefix: 'my-app' };
```

Pass it as the host's `accountsHost`. `name` is how refusals name the host. No account may set a variable starting with one of the `variablePrefixes`. `keychainPrefix` plus a hash of the data folder names the keychain items. `HOME`, `PATH`, the CLIs' folder variables and duplicates are always refused. Keep the prefix and the data folder when you move a host, or it loses its secrets.

## The environment

Without an `env` the host gives its CLIs its own environment, filtered by `cliEnvironment`. Filter more with `environmentPolicy`:

```ts
import { cliEnvironment } from '@adecore/agents/host';

const env = cliEnvironment(process.env, {
    sessionPrefixes: ['MYAPP'],
    variables: ['OTHER_SESSION_TOKEN'],
    prefixes: ['UNTRUSTED_']
});
```

`variables` removes names, and `prefixes` removes names starting with one. `sessionPrefixes` removes `<prefix>_HOOK_*`, `<prefix>_CONTEXT_*` and `<prefix>_SESSION_ID` and keeps the rest, such as `MYAPP_HOME`. Without this, a host started inside an agent session hands that session's callbacks to its own agents. Filtering never changes its input. A legacy set of hook, context and session variables is always removed, whatever the policy. The names are in [`host/environment`](https://github.com/basmilius/adecore/blob/main/packages/agents/src/host/environment.ts), behind `@adecore/agents/host`.

An `env` you pass is used as is, unless you also pass `environmentPolicy`. Add a chat's own credentials in `envFor` on the core.

## Usage

`UsageService` reads the CLIs' transcripts, keeps an index in the data folder, and answers `usage.summary` for a period in the viewer's time zone. `usage.subscribe` keeps it scanning while a client follows. Prices come from LiteLLM's price table, or from a bundled snapshot when that cannot be fetched. Dollars convert to euros at the ECB reference rate from the Frankfurter API. Every cost is an estimate, and a model without a known price costs `null`.

`UsageMonitor` periodically reads each plan's remaining share from the CLIs and merges what running turns report. It answers `usage.limits` and sends `usage.limitsChanged`. For a provider with no CLI to ask, such as a subscription API the host calls with its own key, the host answers through `plans` with a `ProbeResult`, using `fraction` for each window's share.

The scanner reads Grok's per-session `usage.json` under `$GROK_HOME/sessions/` (default `~/.grok`) without counting a turn twice. Grok's own cost (`costUsdTicks`) wins over the price table. Grok has no plan reader, so it has no limits.

Every provider other than Claude Code, Codex and Grok needs the host to log its calls, which the scanner reads like a transcript. An ACP agent can write that log itself (see [ACP agents](/agents/acp#usage)). `hostUsageLine` writes one call (a `HostUsageEntry`) with the token kinds apart: `input`, `cacheRead`, `cacheWrite`, `output`, `reasoning`. Map your API's counts onto them, checking whether its input includes the cached part. Add a root for that folder, with its provider, to the `roots` of the `UsageService`.

`AgentHost` fetches prices and rates when a page asks. A host that may not reach the network makes its own `UsageService` with `allowPriceFetch: false` and wires the handlers itself. The bundled table then prices everything. `knownProjects` lets the usage page show a folder under your project's name.
