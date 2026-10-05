# Providers and models

The built-in `ChatProvider` values are Claude Code and Codex. Other `AgentKind` values can appear in records but a default `ProviderRegistry` does not offer chat implementations for them. `get(kind)` returns an unavailable fallback for an unoffered kind; it does not invent a backend.

## Prerequisites and boundaries

Install the intended CLI, authenticate it using its own supported login flow, and give the host an environment that can find its executable. Provider detection is availability/version probing, not a login guarantee. Model access and provider services remain external prerequisites. Neither package bundles a provider binary, installs it, or establishes universal compatibility with future CLI versions.

Claude uses a long-lived `-p` process with stream-json input/output and stdio permission requests. Codex uses `codex app-server` over stdio JSON-RPC. Captured fixtures include Claude Code `2.1.285` and Codex `0.159.2` frames; earlier version-specific adaptations also remain in the implementation. Treat those as compatibility evidence, not a minimum-version promise or a claim about the latest release.

The process group implementation is written for Node's detached processes and negative-pid signaling. It is tested on the current host and in packed Node consumers. Validate shutdown on your deployment OS, especially Windows, before relying on descendant process cleanup.

## Registry and catalogs

`ProviderRegistry({ providers, commands, detect, env })` accepts a custom ordered provider list. The default list contains the built-in chat providers. `commands` overrides executable detection; a backend command override is a separate `ChatCore`/host option. Detection is cached for 60 seconds; `invalidate(kind)` clears it. `oneShotProvider(preferred?)` selects an installed provider supporting one-shot requests or returns null.

`AgentHost` and `wireAgents` construct the two built-ins. For a different provider list, compose `ProviderRegistry` with a `ChatCore` and the required account/store adapters yourself. A `core` factory can replace `options.providers`, but the surrounding default account/limit services retain the wiring's own registry.

```ts
import { ModelCatalogDataSchema } from '@adecore/agent-contracts/model';
import { ModelCatalog } from '@adecore/agents/providers/catalog';

const catalog = new ModelCatalog(
    ModelCatalogDataSchema.parse({
        updatedAt: '2026-10-05T00:00:00Z',
        defaultModel: 'fixture-model',
        profiles: {
            standard: {
                options: [{ id: 'effort', label: 'Effort', type: 'select', choices: [{ id: 'medium', label: 'Medium' }], defaultChoice: 'medium' }],
                contextWindowTokens: { '*': 32000 }
            }
        },
        models: [{ slug: 'fixture-model', name: 'Fixture', profile: 'standard', aliases: ['fixture'] }]
    })
);
const selection = catalog.normalize({ model: 'fixture', options: { effort: 'unknown', unsupported: true } });
```

This fixture normalizes to `fixture-model` with `effort: 'medium'`; unsupported options disappear. Unknown model names fall back to the catalog default. `resolveModel` returns null for an unknown slug/alias, so use it before normalization when a caller expects a refusal instead. `contextWindowFor` reads the selected profile and returns null when unknown.

`replace(validatedData)` rejects copies older than the catalog shipped with the instance. It compares to that shipped timestamp, not to the latest accepted replacement; enforce monotonically increasing updates in your catalog adapter if needed. Bundled `providers/claude-models.json` and `providers/codex-models.json` are package data, not live discovery.

## Permission mapping

| Runtime mode        | Claude permission flag | Codex approval policy / sandbox  |
| ------------------- | ---------------------- | -------------------------------- |
| `supervised`        | Provider default       | `untrusted` / `read-only`        |
| `auto-accept-edits` | `acceptEdits`          | `untrusted` / `workspace-write`  |
| `auto`              | `auto`                 | `on-request` / `workspace-write` |
| `full-access`       | `bypassPermissions`    | `never` / `danger-full-access`   |

A plain core defaults to `full-access`. Select and clamp mode in the consumer. `MODE_ORDER`, `narrowerMode`, and `ceilingForOpening` support a host-maintained permission ceiling. Codex has no separate policy matching every Claude mode exactly; the table is the adapter's mapping.

`claude.allowedTools` gives named tool patterns permission in every mode. `codexRules: { app, commands }` writes command-prefix rules into the default Codex home and configured accounts. The host chooses the rule filename and command prefixes. A failed write is logged and leaves normal approval behavior active. These options are permission grants, so keep them tied to the host's authorized operations. No application-specific command is allowed by default.

## Provider capabilities

Read `provider.list` and its capabilities before offering controls. Claude reports before/after edits and prompt compaction; it supports denial reasons and slash commands. Codex streams tool output, supplies unified diffs, supports native compaction and async questions, and does not report direct turn cost or accept a denial reason in the same way. Both support attachments, mentions, remembered permission rules, and thinking. Provider-reported context/cost fields differ; the catalog supplies Claude's selected context size.

## A custom backend

A `ChatProvider` describes kind, name, catalog, capabilities, command, resume template, detection, first-prompt arguments, and `createBackend(launch, host)`. Optional home/login metadata enables accounts; optional one-shot methods enable title/other one-shot requests.

`ChatBackend` owns the process and speaks the provider protocol. It reports normalized `BackendEvent` values through `BackendHost.onEvent`; `ThreadProjector` creates item ids and updates the thread. Required operations are `start`, `sendTurn`, `compact`, `interrupt`, approval/question responses, `stop`, and async `dispose`. Optional skill/thread/task/title operations represent provider capabilities. An unsupported response id returns false so the session can refuse it.

Keep provider ids separate from thread item ids and emit `turn.accepted` when acknowledgement is supported. `stop()` closes input for a graceful exit; `dispose()` terminates the process group. See the shipped [backend interface](https://github.com/basmilius/adecore/blob/main/packages/agents/src/chat/backend.ts) and [fake providers](./testing-and-troubleshooting) when implementing an adapter.
