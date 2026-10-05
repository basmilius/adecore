# Providers and accounts

`AgentKindSchema` accepts `claude`, `codex`, `gemini`, `copilot`, and `apple`. This is a vocabulary shared with hosts that may offer terminal agents. It does not promise a chat backend for every kind. The backend currently ships Claude Code and Codex integrations.

`AgentStatusSchema` accepts `running`, `needs-you`, `idle`, `error`, and `exited`. Terminal `AgentInfo.live` separates a current process from a session that can be resumed. Suggested titles are plain text, not instructions; `SUGGESTED_TITLE_LIMIT` is 80 UTF-16 code units.

## Catalogs and selections

`ModelInfo` is display metadata. `ModelOptionDescriptor` is a union of select options with choices/defaultChoice and boolean options with defaultValue. A `ModelSelection` has a nonempty model string and a record of string or boolean options. Parsing a selection checks that shape, not whether a provider actually offers the model or option. The backend catalog normalizes it.

```ts
import { ModelCatalogDataSchema, ModelSelectionSchema, resumeCommandFor } from '@adecore/agent-contracts/model';

const catalog = ModelCatalogDataSchema.parse({
    updatedAt: '2026-10-05T00:00:00Z',
    defaultModel: 'example-model',
    profiles: {
        standard: { options: [], contextWindowTokens: { '*': 32000 } }
    },
    models: [{ slug: 'example-model', name: 'Example model', profile: 'standard' }]
});
const selection = ModelSelectionSchema.parse({ model: catalog.defaultModel, options: {} });
const resume = resumeCommandFor('example-cli {flags} --resume {id}', "session'1", ['--read-only']);
```

The example catalog is host-provided fixture data. `ModelCatalogDataSchema` requires at least one model, an ISO datetime, safe model slugs, a profile for every model, and a default model in the list. Context sizes are positive integers. It does not check uniqueness of models/aliases or whether a select default names a choice; validate those relationships in a custom catalog publisher if needed.

`resumeCommandFor(template, sessionId, flags = [])` shell-quotes the session id and expands the standalone `{flags}` word. Flags are already shell words supplied by the caller; this helper does not quote untrusted flag arguments.

## Capabilities and modes

`ProviderInfo` describes availability, version, models, default model, capabilities, and a terminal resume command. Build UI affordances from capabilities: chat/terminal/hooks, attachment and mention support, tool output streaming, diff format, denial reasons, remembered permissions, async questions, compaction, cost/context/thinking reporting, and slash commands. A schema validates booleans and enum values; it cannot test the installed CLI.

`RuntimeModeSchema` orders policies as `supervised`, `auto-accept-edits`, `auto`, and `full-access`. The backend maps them to each provider. Always choose a mode deliberately when creating a chat; the plain backend defaults to `full-access`. A consumer can narrow it in `ChatCore.runtimeModeFor`. The requested mode and the effective mode can differ, so keep provider-reported policy visible when it exists.

## Account records

`ProviderAccountIdSchema` accepts a slug beginning with a lowercase letter, followed by up to 63 lowercase letters, digits, underscores, or hyphens. It is never a filesystem path. An omitted account or an id equal to the provider kind selects the default account.

Accounts describe a provider kind, optional label/color/enabled flag, config `home`, optional Codex `shadowHome`, and optional environment variables. Absent `enabled` means enabled. Account `kind` remains a nonempty string so unknown provider records can survive an older host. `ProviderAccountStatus` is a live check result, not persisted truth. Its state is `checking`, `disabled`, `not-found`, `signed-out`, `ready`, `folder-missing`, `unavailable`, or `failed`.

`accounts.save` sends the whole account map. Omitting an id removes that account record while keeping its folder. `accounts.create` takes a known kind and a trimmed 1 to 80 character label; the backend mints the id. `accounts.watchLogin` starts asynchronous polling and replies immediately; `accounts.refresh` waits for checks and returns a snapshot.

Sensitive environment values leave the host as `value: ''` with `valueRedacted: true`. Sending that redacted value back preserves the saved secret. `secretsAvailable` indicates host storage support and is optional for older hosts. A schema checks variable names, but duplicate/reserved names and folder compatibility are backend policy checks. See [accounts and environment](../agents/accounts-and-environment).
