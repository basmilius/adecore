# Validation and compatibility

Zod schemas validate runtime data. TypeScript types alone cannot validate a frame, a JSON file, or data from a provider. `.parse()` throws a `ZodError`; `.safeParse()` returns a success discriminant and issues on failure.

```ts
import { ChatSendPayloadSchema, parseServerFrame } from '@adecore/agent-contracts';

const checked = ChatSendPayloadSchema.safeParse({ chatId: 'chat-1', text: '   ' });
if (!checked.success) {
    const messages = checked.error.issues.map((issue) => issue.message);
}
const envelope = parseServerFrame({ id: null, ok: false, error: { code: 'bad-request', message: 'Invalid frame' } });
```

`parseRequest` and `parseServerFrame` return `{ ok: true, value }` or `{ ok: false, message }`, with a prettified validation message. They do not throw for normal validation failures. Use the selected table schema to validate nested payloads/results afterward.

## Defaults and unknown fields

Most object schemas use `z.object`, which strips unknown keys from parsed output. They generally have no runtime defaults; an optional value stays absent. Consumer behavior gives absences meaning, such as an enabled account, an empty optional queue, or a user-initiated turn. Do not replace every omitted field with null: optional and nullable are different contracts.

Some relationships are deliberately outside schemas. `ChatInfo` can carry an approval/question summary without schema-enforced pairing between its `kind` and optional content. Models need catalog normalization. Account folders and reserved variables need backend checks. Timestamps mostly validate as numbers, not as an authorization clock. Preserve these distinctions when composing a stricter host schema.

## Public entrypoints

The root reexports all groups below. `/port` exports types only. These are the complete explicit entrypoints in the package manifest.

| Import suffix        | Definitions                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| root                 | All schemas, types, limits, and helpers                                                                               |
| `/agent`             | `AgentKind`, status/info, suggested titles, terminal approvals and preferences                                        |
| `/chat`              | Chat metadata/items/events, attachments, queue, questions, bookmarks, history, fork/continuation payloads and helpers |
| `/envelope`          | Request/reply/event envelopes, `WireError`, and parsing helpers                                                       |
| `/ids`               | `SessionIdSchema` and `SessionId`                                                                                     |
| `/model`             | Models/catalogs/options/selections, capabilities, runtime modes, and `resumeCommandFor`                               |
| `/port`              | `FramePort`                                                                                                           |
| `/protocol`          | `EmptySchema`, request/event tables, and table key types                                                              |
| `/provider-accounts` | Account ids, maps, variables, statuses, and operation payloads                                                        |
| `/task`              | Task state/results and `TaskChangedEventSchema`                                                                       |
| `/text`              | `clipText`                                                                                                            |
| `/usage`             | Usage totals, summaries, price/scan/root/rate/limit schemas and helpers                                               |
| `/worktree`          | Worktree metadata and inspection counts                                                                               |

Read the [source definitions](https://github.com/basmilius/adecore/tree/main/packages/agent-contracts/src) for individual fields. Subpath names are stable consumer imports; avoid adding `/src` or an extension.

## Protocol and storage compatibility

A package namespace change does not change request names, event names, item discriminants, enum members, or saved record shapes. Retain the historical host-owned subagent origin in existing records and frames. Its value remains in `ChatSubagentItemSchema`; the migration must not translate it to a new branding value.

Strict clients can reject an entire history page when one item kind or enum value is unknown. Optional fields are the current extension mechanism. A change to a discriminant or enum needs coordinated consumer changes, fixtures, and any generated model checks. These contracts have no negotiated version field of their own; a larger host protocol may define one.

JSON serialization preserves frame shapes, not schema instances. Base64 uploads become paths in persisted attachments. Chat record extras are backend-owned data beside the thread and are not added to these wire schemas. Account storage preserves raw unknown-provider entries through its own store, even though normal schema parsing strips extra keys.

For an import migration, retain data directories, record ids, provider transcript folders, sequence/reset metadata, and host protocol table names. Check old records with the new imports before writing them back. See [backend migration](../agents/migration) for shutdown, environment, and packed-consumer checks.
