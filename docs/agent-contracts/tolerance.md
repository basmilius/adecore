# Newer hosts

A client and a host do not always ship together. A client on an older version may meet a host that sends an item kind, an event type or a status word the client never saw. A strict parse refuses the whole reply over that one value, so a single new item empties a thread. `readTolerant` reads such a reply anyway and says what it had to give up.

The host keeps parsing strictly. Tolerance is only for what a client reads from a host, never for what a host receives.

## Stamps

A schema says where a newer host may add something with a stamp. A stamp is metadata on the schema object and changes nothing about `parse` or `safeParse`.

| Helper | Marks | A value this version cannot read |
| --- | --- | --- |
| `openUnion(schema, name, { tag, base })` | A union a newer host may add a member to, or a value inside a member | Stays in its place as `{ [tag]: 'unknown', ...base, raw }`, if its tag is a string and every field in `base` reads |
| `lossyItems(arraySchema)` | A list of which one element should not empty the page | Is left out |
| `openValues(enumSchema, name, { words, known })` | A vocabulary a newer host may add a word to | Is kept as the word it is |

A list of an open union also leaves out a member without the `base` fields, because that member has no place to keep. `words` tells a typed client in another language how to model the known words: as `cases` beside an unknown case (the default), or as plain `strings`.

`wireStampOf(schema)` returns the stamp on one schema object, as a `WireStamp`. `wireStampsIn(schema)` returns every stamp below a schema as `WireStampAt` entries, each with the path of the input it applies to. A generator for another language reads them, so a client in that language degrades the same values. The stamps live in a `WeakMap` keyed by the schema object, so they still work when the app and the contracts load different copies of zod.

These contracts stamp `ChatItemSchema` (tag `kind`, base `id`, `createdAt` and `turnId`), `ChatEventSchema` (tag `type`), the pending requests of `chat.subagent`, the `chats` of `chat.list`, and the vocabularies of agent and goal statuses, request kinds, runtime modes, usage providers, turn limits, background tasks and tasks. An app stamps its own schemas with the same helpers, and also an ADE CORE schema it wants to treat as open.

## Reading

```ts
import { ChatAttachResultSchema, readTolerant } from '@adecore/agent-contracts';

const read = readTolerant(ChatAttachResultSchema, reply);
if (!read.success) {
    throw new Error(read.error.message);
}

for (const item of read.data.items) {
    if (item.kind === 'unknown') {
        // Show a muted row. Never answer, fork from or write back this item.
    }
}
```

`readTolerant` runs the strict parse first. A reply this version fully knows comes back exactly as `safeParse` returns it, with an empty `degraded`. Otherwise it degrades the nearest stamp around each value that failed and reads the rest as strictly as before. A failure with no stamp around it still refuses the whole input, with the error of the strict parse. A container with a refinement on it stays strict, because the refinement cannot run on a value that has a degraded part.

The result is a `ToleratedRead`: `{ success: true, data, degraded }` or `{ success: false, error }`. Each `WireDegradation` names its path in the input:

| `kind` | Means |
| --- | --- |
| `unknown-member` | A member of the open union `name` with the tag `tag` became unknown |
| `dropped-element` | A list left out the element at `path` |
| `unknown-word` | The vocabulary `name` kept a word it does not know |

A client can report these, for example once per request type, so a version mismatch shows up before people notice it.

## Unknown items and events

`ChatUnknownItem` is `{ kind: 'unknown', id, createdAt, turnId, raw }`, where `raw` is the item as the host sent it. `ChatUnknownEvent` is `{ type: 'unknown', raw }`. No host ever sends either one. A thread leaves an unknown event unapplied. Nothing waits on an unknown item, answers it, forks from it or bookmarks it. An approval or question that did not read is also unknown, so a client never answers a request it cannot read.

## Types

`Tolerant<T>` is `T` as `readTolerant` may return it. Every open union also holds its unknown member, and every open vocabulary also holds an `UnknownWord`. An `UnknownWord` is a string that matches none of the known words, so a `switch` over a status needs a `default`. `OpenUnions` and `OpenWords` are the tables these contracts stamp, keyed by stamp name. A type matches an entry only when it is that exact type.

An app with stamps of its own extends the tables. `OpenUnionTable` and `OpenWordTable` are the shapes they take, and `TolerantWith<T, Unions, Words>` applies them:

```ts
import { readTolerant, type OpenUnions, type OpenWords, type TolerantWith } from '@adecore/agent-contracts';

type AppWords = OpenWords & { ProjectIcon: ProjectIconName };
type AppRead<T> = TolerantWith<T, OpenUnions, AppWords>;

const read = readTolerant<typeof ProjectListResultSchema, OpenUnions, AppWords>(ProjectListResultSchema, reply);
```

The types of a host stay strict. Only what a client reads carries the wider types.
