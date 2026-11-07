# Accounts

An account is one config folder of a CLI, passed through the variable the CLI reads it from. The person signs in with the CLI itself. [`@adecore/agents`](/agents/accounts) keeps the accounts, and the [providers pane](/agents-react/providers/providers-pane) edits them.

```ts
import { ProviderAccountsSchema, topAccountOf, type ProviderAccount } from '@adecore/agent-contracts/provider-accounts';
```

## The record

`ProviderAccountIdSchema` (`ProviderAccountId`) is a slug: a lowercase letter, then up to 63 lowercase letters, digits, underscores or hyphens. It is never a path. No account, or an id equal to the provider's kind, means the default account.

`ProviderAccount` (`ProviderAccountSchema`) is `{ kind, label?, color?, enabled?, home?, shadowHome?, env?, order?, shareConfig? }`. Absent `enabled` is on. `order` is the account's place among the accounts of its CLI, lowest first. `shareConfig` is on when an extra account reads the default account's instructions, skills, agents and commands; absent is off. Only `accounts.shareConfig` sets it, and a save without it keeps the stored value. `home` is the config folder (`~` allowed), absent on the default account. `shadowHome` is Codex only: a separate login folder that shares everything else with `home`. `kind` is a plain string, so records of unknown CLIs still parse and round-trip. `ProviderAccountMap` (`ProviderAccountMapSchema`) holds the accounts by id.

`ProviderAccountVariable` (`ProviderAccountVariableSchema`) is `{ name, value, sensitive, valueRedacted? }`, a variable the host sets in the CLI's environment. The host never sends a sensitive value. It sends `value: ''` with `valueRedacted: true`, and saving that back keeps the stored secret.

## Order

`orderedAccountIds(accounts, kind)` returns the ids of one CLI's accounts in the person's order: by `order`, then the default account, then the rest by id. A machine where nobody reordered keeps the default account on top. `topAccountOf(accounts, kind)` returns the account a start takes when nothing names one: the first in that order that is on, or else the CLI's default account.

```ts
const accounts = ProviderAccountsSchema.parse(snapshot).accounts;
const startOn = topAccountOf(accounts, 'codex');
```

## Status

`ProviderAccountStatus` (`ProviderAccountStatusSchema`) is the CLI's last answer about an account, never stored. Its `state` is a `ProviderAccountState` (`ProviderAccountStateSchema`): `checking`, `disabled`, `not-found`, `signed-out`, `ready`, `folder-missing`, `unavailable` or `failed`. It has optional `email`, `plan`, `organization` and `message`. `transcripts` is where the account writes conversations. A chat can move only between accounts that share it.

## Requests

`ProviderAccounts` (`ProviderAccountsSchema`) is the snapshot that most account requests answer with, and that `accounts.changed` carries: `accounts`, `statuses`, `secretsAvailable?`, `loginCommands?` (the terminal sign-in command per CLI), `chatLogins?` (kinds that sign in from a chat) and `sharedConfigKinds?` (kinds whose extra accounts can share the default account's setup). `secretsAvailable` says whether the host can store secrets.

| Request               | Payload and answer                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `accounts.list`       | The snapshot.                                                                                          |
| `accounts.save`       | The whole map. A missing id is removed, and its folder stays. An account saved without `order` keeps the one it had. |
| `accounts.reorder`    | `{ kind, ids }`: the accounts of one CLI in a person's order. An account of that CLI left out follows in the order it had; an id of another CLI or one the host does not have is refused. |
| `accounts.shareConfig` | `{ id, shared }`: turns the sharing of the default account's setup on or off for one extra account. Refused with `invalid-account` for a default account, an unknown id and a CLI that shares nothing. |
| `accounts.create`     | `{ kind, label, color? }`, with a trimmed label of 1 to 80 characters. Returns the snapshot and the new `id`. |
| `accounts.refresh`    | Asks every CLI again and answers when all did.                                                         |
| `accounts.watchLogin` | `{ id }`. Answers at once, then polls the CLI until the account is signed in.                          |

[Requests and events](/agent-contracts/requests#accounts) names the schema of each payload and answer.
