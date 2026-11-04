# Accounts

An account is one config folder of a CLI plus the environment variables a person set for it. The person signs in with the CLI itself, and the host only asks the CLI who is signed in. Each offered CLI has a default account that uses the CLI's own folder, with the CLI's kind as id. The offered kinds come from the registry's `kinds()`, or from `KNOWN_AGENT_KINDS` when it returns none. The host keeps accounts of other kinds but never checks them.

`ProviderAccountsService` keeps a host's accounts. `AgentHost` exposes one as `host.accounts`. It answers the `accounts.*` requests, checks sign-ins periodically, and polls the CLI for a while after `accounts.watchLogin`. Accounts live in `providers.json` without secrets.

Under a non-default account, the host removes the variables that would sign the CLI in another way, points the CLI's folder variable at the account's folder, and adds the account's own variables. A chat can move only between accounts of the same CLI that share a conversation folder (`canContinue`). Otherwise the host fails with `account-incompatible`. An account it cannot start fails with `account-unavailable`.

A person orders the accounts of each CLI with `accounts.reorder`, which writes `order`. A start that names no account takes the top one that is on (`defaultFor`, `topAccountOf`). A host that gives a place its own default and turned-off accounts, such as a project, decides with `chooseAccount` in `ChatCoreHooks.openingAccount`. A named account the place turned off fails with `account-off-in-project`. A preferred account that cannot take the start gives way to the next usable one, with the reason in `passedOver`.

A CLI keeps accounts when its provider has a `home`: the folder variable, the default folder, the variables that sign it in by themselves, and the `loginCommand` a person types in a terminal. A CLI that signs in from its first chat, such as an ACP agent, leaves `loginCommand` out. Its kind appears in `chatLogins` instead of `loginCommands`, and its accounts count as `ready` without a check.

A provider with its own `askAccount(command, env)` answers for itself, as every ACP provider does (see [ACP agents](./acp#accounts)). The others go through the service's `ask`, which by default knows Claude Code (`claude auth status --json`) and Codex (`account/read`). A host's own `ask` must answer for every kind. A kind in `loginCommands` that nothing can ask is also listed in `silentLogins`, so a login window should not promise to close by itself.

`accounts.create` makes a folder for the new account under the data folder. For Codex it is a shadow home with its own `auth.json` and links to the shared home's sessions, skills and rules, so accounts continue each other's threads. A file already in the way is reported as not shared. This needs Codex to keep its login in a file, not the keychain.

## The types behind it

- `ProviderAccountsOptions` are the options of the service: the data folder, the `AccountsHost`, the providers, the environment, an `ask` for CLIs without a reader of their own, and the `secrets`.
- `chooseAccount` takes an `AccountChoiceInput` (the kind, the accounts, the named and preferred account, and those turned off) and returns a `ChosenAccount`. A passed-over account carries an `AccountUnusable` reason, such as `signed out` or `at its usage limit`.
- `AccountLaunches` is how a terminal or a chat starts a CLI under an account: its environment, its transcript folder and its config folder. `launchEnv(accounts, kind, account, baseEnv)` returns the environment of a launch; without accounts wired only the default account starts. `storedAccount(kind, account)` is the id a record keeps: none for the default account, so nothing changes on disk for a host without accounts.
- An `AskAccount` asks a CLI who is signed in and answers an `AccountReading`: `signedIn`, `email`, `plan` and `organization`. `AcpAccountProbe` holds what `askAcpAccount` needs to ask an ACP agent.
- Making a Codex account reports a `ShadowHomeReport`: what it linked, what was in the way and stayed unshared, and whether the login itself would be shared.

## Secrets

A variable marked `sensitive` goes to the macOS login keychain, never to `providers.json`. On other platforms it fails with `secrets-unavailable`. Clients get it as `''` with `valueRedacted: true`, and saving that back keeps the stored value. A sensitive value holds printable ASCII only.

```ts
import type { AccountsHost } from '@adecore/agents/providers';

const accountsHost: AccountsHost = { name: 'My app', variablePrefixes: ['MYAPP_'], keychainPrefix: 'my-app' };
```

Pass it as the host's `accountsHost`. `name` is how refusals name the host. No account may set a variable starting with one of the `variablePrefixes`. `keychainPrefix` plus a hash of the data folder names the keychain items. `HOME`, `PATH`, the CLIs' folder variables and duplicates are always refused. Keep the prefix and the data folder when you move a host, or it loses its secrets.

`keychainService(host, home)` is that name. A `SecretStore` reads, writes and removes the secrets. Pass one as `secrets` in the service's options to keep them elsewhere, such as in memory in a test; absent is the platform's own. `variablesProblem(variables, reserved)` says what is wrong with an account's variables, such as a name set twice or a reserved one, or returns `null`. `ReservedVariables` holds the host and the CLIs' folder variables it checks against.

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

The policy is a `CliEnvironmentPolicy`. An `env` you pass is used as is, unless you also pass `environmentPolicy`. Add a chat's own credentials in `envFor` on the core.

