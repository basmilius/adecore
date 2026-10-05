# Migration

Migrate package imports and consumer adapters together while preserving wire/storage formats. The backend subpaths remain supported imports, including filesystem, serializer, record-directory, client-sinks, watch helpers, outbox, and task modules. Do not replace them with private `/src` imports.

## Preserve existing records

Keep the data directory, chat ids, encoded filenames, account config/transcript homes, outbox kinds/payloads, task wake state, lineage ceilings/end marks, and notice queues. Chat snapshots retain sequence/reset metadata and host extras; native provider session ids still drive resume. Keep account keychain prefix and data-root identity so secrets remain reachable.

Compose `AGENT_REQUEST_SCHEMAS`/`AGENT_EVENT_SCHEMAS` into the host's existing table without changing its frame names. A namespace rename requires no wire version bump by itself. Preserve the historical host-owned subagent origin discriminant. Strict clients and generated models need fixture/generation checks before any actual shape change.

Ordinary `z.object` parsing strips unknown nested fields. Avoid reading and rewriting future-version data through a narrower schema without a migration policy. The backend deliberately refuses unreadable chats and preserves raw unknown-provider account entries. Retain those behaviors in a custom store.

## Reconnect host adapters

Replace old import prefixes with `@adecore/agent-contracts` and `@adecore/agents`, retaining each supported module suffix. Then wire the application's existing sender verification, per-operation authorization, placement, context commands, and process/account policy. The package does not install them.

Supply host identity through `client` and `accountsHost`, environment filtering through `environmentPolicy`, and context permission patterns through `claude`/`codexRules` only when authorized. Retain inherited session filtering; removing it during a rename can route child hooks into the session that launched the host. Inject newly minted session state after filtering.

For tasks and messages, retain host work kinds, idempotent handlers, assignment/result wording, notices, and descendant-ending policy. Load stores, convert restarted background limits, recover task obligations, then start the worker. Keep one coordination wiring per core lifetime.

A client/UI migration also needs its own draft/preference storage setup before first access, CSS source scanning, locales, and drag producer/consumer updates. Follow [agent views](../agents-react/) for those client responsibilities. Backend record continuity does not migrate browser storage automatically.

## Validate the consumer

1. Read representative saved chats, queued attachments, account records, and task/outbox/notice state without launching real providers.
2. Run a fake-provider turn through the actual host transport and check streamed text, approvals/questions, replay, error codes, disconnect, and shutdown.
3. Test source-condition imports and compiled default imports from a packed artifact outside the workspace. Build contracts before agents and any React consumer.
4. Check provider login/config paths and inherited environment filtering with fixtures. Verify permission ceilings and sender checks at the application boundary.
5. Check restart recovery, task batching, paused background work, message wake suppression, and descendant shutdown using injected clocks/processes.
6. Perform an authorized real-provider/platform acceptance check separately when the consumer is ready.

Keep old implementations and data backups until the complete consumer cutover and migration validation pass. Successful package checks alone do not establish the consumer's filesystem permissions, IPC ownership, UI behavior, or shutdown correctness. Publication and first-version setup remain separate release work; these packages are currently private at `0.0.0`.
