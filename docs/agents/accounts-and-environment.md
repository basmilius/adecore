# Accounts and environment

An account is a provider config folder plus selected environment variables. Authentication stays with the provider CLI. `ProviderAccountsService` loads/saves records, checks login state, prepares account homes, and implements `AccountLaunches` for a chat or terminal adapter.

## Environment policy

```ts
import { cliEnvironment } from '@adecore/agents/host/environment';

const input = {
    HOME: '/home/example',
    PATH: '/usr/bin',
    APP_HOME: '/home/example/.app',
    APP_CONTEXT_TOKEN: 'inherited-context',
    APP_HOOK_URL: 'inherited-hook',
    APP_SESSION_ID: 'inherited-session',
    OTHER_SESSION_TOKEN: 'inherited-token'
};
const env = cliEnvironment(input, {
    sessionPrefixes: ['APP'],
    variables: ['OTHER_SESSION_TOKEN'],
    prefixes: ['UNTRUSTED_CONTEXT_']
});
```

`env` retains `HOME`, `PATH`, and `APP_HOME`. Filtering does not mutate its input and removes undefined values. `variables` matches exact names; `prefixes` matches a leading string. `sessionPrefixes` removes `<prefix>_HOOK_*`, `<prefix>_CONTEXT_*`, and `<prefix>_SESSION_ID`, keeping home/config variables. Trailing underscores are removed; an empty prefix throws.

Historical inherited hook/context/session filtering always remains active, even when a custom policy is supplied. This prevents a host launched inside another agent session from sending callbacks into that inherited session. These names are compatibility exclusions, not environment defaults supplied by Adecore.

`AgentHost` and `wireAgents` filter `process.env` when `env` is absent. An explicit `env` without `environmentPolicy` is already prepared and stays intact, apart from unset values when a process launches. If you pass both, policy filtering runs on the explicit environment too. Filter inherited state first, then inject fresh host session credentials through a controlled adapter such as `envFor`.

## Config homes and account compatibility

Claude uses `CLAUDE_CONFIG_DIR` with `.claude` under the person's home as fallback. Codex uses `CODEX_HOME` with `.codex`. Isolating a config home avoids changing `HOME`, which can change provider keychain behavior. Nondefault account launches remove inherited login variables named by that provider, point at its config folder, and then apply explicitly selected account variables.

An absent account or account id equal to the kind means the provider default. Stored chats omit the default account id to preserve older records. `AccountLaunches.envFor` throws `account-unavailable` for an unavailable account; `canContinue` permits another account only when it is the same provider and reads the same transcript folder. A config change does not authorize a different account's files by itself.

A Codex shadow home keeps `auth.json` private and shares sessions, archived sessions, skills, rules, and other eligible entries by symlink. Caches/logs/socket-related entries and SQLite journals stay local. Existing files or conflicting links are left alone and reported as `unshared`; a linked private login is reported as `sharedLogin`. This requires file-backed Codex credentials. `prepareShadowHome` never deletes or overwrites existing entries and refuses identical shared/shadow folders.

## Host identity and secrets

```ts
import type { AccountsHost } from '@adecore/agents/providers/accounts/variables';

export const accountsHost: AccountsHost = {
    name: 'Example host',
    variablePrefixes: ['APP_'],
    keychainPrefix: 'example-host'
};
```

Pass that object as `accountsHost` to the wiring. `HOME`, `PATH`, provider folder variables, and host-reserved prefixes cannot be set by an account. Duplicate variable names are refused. Sensitive values must be printable ASCII for the current keychain implementation.

By default sensitive values use the macOS login keychain through `security`; other platforms have no built-in secret store and refuse sensitive saves with `secrets-unavailable`. Direct `ProviderAccountsService` composition accepts an injected `SecretStore` or null. `AgentHostOptions` does not expose a `secrets` adapter.

Secrets do not enter `providers.json` or outbound snapshots. A snapshot sends an empty sensitive value with `valueRedacted: true`, and saving it preserves the keychain value. Keychain service names include `keychainPrefix` and a hash of the resolved data directory. An import migration must preserve both identities to retain access to existing secrets.

## Accounts and usage clocks

Scheduled account checks run about every 15 minutes with failure backoff up to an hour. Login watches check about every three seconds for up to five minutes. `watchLogin` answers the request immediately and publishes state later. `refresh` awaits all checks.

`UsageMonitor` refreshes plan limits about every five minutes, with backoff and account activity selection. Running turn updates merge into those readings. `UsageService` scans Claude/Codex transcript roots, indexes usage, and aggregates summaries in the requested time zone. A scan remains fresh for a minute, and `usage.subscribe` keeps it scanning while at least one client follows.

Usage requests can fetch the configured price table and exchange-rate data. `background: false` only disables scheduled account/limit checks. For an offline usage host, compose `UsageService({ home, knownProjects, roots, allowPriceFetch: false })` and expose handlers through your own wiring. The standard `AgentHost` options do not expose this switch; its usage service enables fetches on demand. With fetching off, pricing uses its bundled/cache data and the exchange-rate helper uses an existing cache or null. The built-in exchange helper targets EUR; it does not accept an arbitrary currency option.

The default wiring supplies no known application projects. A host-provided `knownProjects` adapter adds names/ids to a custom usage service. Costs are estimates with price provenance; null model cost means unknown pricing. See [usage contracts](../agent-contracts/tasks-and-usage).
