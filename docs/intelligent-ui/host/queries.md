# Live queries

A block can show data that changes after the agent wrote it, such as the state of a build. The agent declares a query of a source the host registered. The host reads it with the access of the chat that wrote the block, and the page shows the newest reading while the block is in view.

```ui
$branch = "main"
$runs = @Query("ci.runs", {branch: $branch, limit: 5})
<Segmented value={$branch}>
<Option value="main">main</Option>
<Option value="release">release</Option>
</Segmented>
<Table rows={$runs}>
<Column key="name" title="Run"/>
<Column key="ms" title="Time" as="duration"/>
</Table>
```

## Declaring a query

`$name = @Query("source", {arguments})` is a declaration at the top of the block:

- The source is a string literal the host registered. An unknown source is `unknown_query`.
- The arguments are a record. They may read declared local state, so a control can change what is read, but never a query result.
- The source's schema must accept the arguments evaluated with the defaults, or the block gets `invalid_query`.
- A block declares at most `UI_HOST_LIMITS.queries` (8) queries.
- A query is read only.

`$name` holds the result. Until the first reading arrives, parts that read it draw their fallback.

## Registering sources

`UiCompileOptions.querySchemas` maps each source name to its zod argument schema. With [`@adecore/agents`](/agents/chats#live-ui-sources), pass a `ChatUiHost` as `ChatCoreOptions.intelligentUi` and the sessions take the schemas from it:

```ts
import { z } from 'zod';
import type { ChatUiHost } from '@adecore/agents/chat';

const intelligentUi: ChatUiHost = {
    // Called once per reply that may read a source or name a link; the result stays on the backend.
    capture: async (info) => ({ projects: await projectsOf(info) }),
    sources: {
        'ci.runs': {
            args: z.strictObject({ branch: z.string(), limit: z.number().int().positive().optional() }),
            result: z.array(z.strictObject({ name: z.string(), ms: z.number() })),
            authorize: async (info, access, args) => assertCanRead(info, access, args),
            read: (info, args, signal) => fetchRuns(args, signal)
        }
    }
};
```

`projectsOf`, `assertCanRead` and `fetchRuns` stand for your own code. `capture` records what the writing chat may read, once per reply. `authorize` runs before every read with that captured access and the chat's current info, and throws to refuse. `read` returns a result that must pass `result`.

To refuse with a code a client can word itself, throw a `ChatUiRefusal(code, reason)` from `@adecore/agents/chat`: `throw new ChatUiRefusal('project-closed', 'The project is closed.')`. From `authorize` the reading is `refused`, from `read` it is `failed`, and from `ChatUiHost.link` the link stays plain. Keep codes stable across versions, and reuse a host code below when one fits.

## Reading

A client sends `ui.query` with the block's identity, the query name and its input values. The backend then:

1. Finds the stored, completed block at that `revision`, or answers `block-stale`.
2. Checks the query is declared and its source registered.
3. Validates the inputs with `uiValidatedState` and evaluates the arguments with `uiQueryArguments(block, name, input, limits?, queries?)` against the stored block. `queries` holds the newest fresh reading of each query, so a value picked from options a query read passes.
4. Parses the arguments with the source's schema and authorizes them with the captured access.
5. Answers from the cache within ten seconds of the same read, or reads.

`uiValidatedState(block, input, queries?, limits?)` accepts only values a person could have set on screen; see [choices](/intelligent-ui/host/choices#what-a-person-could-have-set). `uiQueryArguments` throws a `UiFailure` (`invalid_query`, `refused_binding`, `invalid_value`) for anything else.

A reading is a `ChatUiQueryReading`: `state` (`fresh`, `failed` or `refused`), the `value` and a `readId` when fresh, `readAt`, and for a failure a `reason` with a stable `code`.

## Limits

`UI_HOST_LIMITS` bounds the host reads per block. The agents host adds its own.

| Limit                         | Value  | Where                                     |
| ----------------------------- | ------ | ----------------------------------------- |
| Queries per block             | 8      | `UI_HOST_LIMITS.queries`                  |
| Link targets per block        | 64     | `UI_HOST_LIMITS.links`                    |
| One read per query and input  | 10 s   | `UI_HOST_LIMITS.refreshMilliseconds`      |
| A changed input reads after   | 250 ms | The agents host                           |
| Reads at once                 | 2 per chat, 16 in all | The agents host            |
| A read times out after        | 8 s    | The agents host; the source is aborted    |
| Result size                   | 64 KB  | The agents host                           |
| Captured access               | 32 KB  | The agents host                           |

The backend reads only when a visible block asks.

## Freshness

When a reply is final, the backend reads every query once and freezes those first readings, the link resolutions and a text fallback in the item's `uiQueries`. A page draws them at once, and a client that cannot read live still has them. `uiQueryFallback(block, values)` builds the fallback text from those first values, so the agent's history keeps what the person saw.

The page reads again while a block is visible and the app is in front: at most every ten seconds, and once more after an input rests for 300 ms. A failed read keeps the last value, muted. Choices stay closed while a block reads, and send the read ids of the values on screen; see [choices](/intelligent-ui/host/choices#live-blocks).

## Reason codes

A failed or refused reading, a plain link and a refused choice carry a stable `code` and a `reason` in words. A client words the codes it knows and shows the reason for others. `uiReasonText` in [agents-react](/agents-react/chat/intelligent-ui#words-and-accessibility) does this.

| Code                  | Meaning                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `block-stale`         | The block changed since the client drew it                       |
| `query-undeclared`    | The block does not declare that query                            |
| `source-unregistered` | The host has no such source                                      |
| `access-unavailable`  | The writing chat's captured access is missing                    |
| `refresh-limit`       | The same query and input were read less than ten seconds ago     |
| `busy`                | Too many reads are running                                       |
| `timed-out`           | The source took longer than eight seconds                        |
| `result-too-large`    | The result is over 64 KB                                         |
| `snapshot-too-large`  | The first readings were too large to freeze                      |
| `stale-read`          | A choice named a read the backend no longer holds for its inputs |
| `links-unsupported`   | The host resolves no links                                       |
| `link-unsupported`    | The node is not a visible link of the block                      |
| `link-unchecked`      | The link has to be checked again                                 |
| `unreadable`          | The page could not reach the backend                             |

Any other error thrown by `authorize`, `read`, `link` or `place` gets a fixed reason (`This query could not be read.`, or `The place could not be looked up.`), because the reason is frozen into the record. Only a `ChatUiRefusal` chooses its words.

`uiReasonText` also words these host codes:

| Code                 | Meaning                                                      |
| -------------------- | ------------------------------------------------------------ |
| `outside-project`    | The source or target lies outside the writer's project       |
| `target-unavailable` | The file, commit, diff or node a link names is gone          |
| `no-unique-match`    | A name the source looks up matches nothing, or more than one |

## Places

A `Place` can give an address instead of coordinates. With `ChatUiHost.place`, the host looks each address up once when the reply settles and freezes the point in `uiQueries.blocks[id].places`, by node id. Every client draws the same point, and the fallback's `Places:` line carries the coordinates.

```ts
import { uiPlaceQueries } from '@adecore/intelligent-ui/places';

const intelligentUi: ChatUiHost = {
    capture: async () => null,
    sources: {},
    // One lookup of one address; `signal` aborts after five seconds.
    place: async (info, { address, name }, signal) => {
        const match = await geocode(address, signal);
        return match ? { state: 'found', lat: match.lat, lon: match.lon, label: match.label } : { state: 'missing', code: 'no-match' };
    }
};
```

`uiPlaceQueries(block, input?, queries?)` returns the complete Places with an address as `{ [nodeId]: { address, name } }`. The host calls `place` for at most `UI_HOST_LIMITS.places` (50) of them. `uiMayReferenceHost` is true for text with a `<Place` that has `address=`.

Your `place` returns `found` with `lat`, `lon` and an optional `label`, or `missing` with an optional `code` and `reason`; the host adds the trimmed `address`. A reading applies only to a node whose current address matches. A lookup that throws, takes over five seconds or fails the schema is frozen as `missing` and never retried. A block has fifteen seconds for all its lookups; the rest freeze as `missing` with `timed-out`, and `signal` aborts. A reply settled while offline keeps `missing`.

Without `place`, nothing is frozen and a map draws only the places the agent gave coordinates for. Leave it out if the host may not store coordinates.
