# Links

A File, Diff, Commit or Node in a block names something the host owns. The host decides whether it becomes a chip a person can open or stays plain text.

## Targets

`uiLinkTargets(block, input?, queries?, limits?)` evaluates a completed block with validated input and lists its visible link targets by node id. It leaves out hidden, unfinished and invalid nodes.

```ts
import { uiLinkTargets } from '@adecore/intelligent-ui/links';

const targets = uiLinkTargets(block);
// { 'item-1:ui:0:0': { type: 'File', path: 'src/terminal/links.ts', line: 148 } }
```

A `UiLinkTarget` is one of:

| Target                          | From                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `{ type: 'File', path, line? }` | `<File path line>`, `<Leaf path>`, `<CodeBlock file start>` |
| `{ type: 'Diff', path }`        | `<Diff path>`, `<Change path>`                              |
| `{ type: 'Commit', sha }`       | `<Commit sha>`                                              |
| `{ type: 'Node', id }`          | `<Node id>`, `<Source node>`                                |

`UiLinkTargetSchema` validates one. A path is at most 4,096 characters and a sha 7 to 64 hexadecimal characters.

## Resolutions

The host answers a target with a `UiLinkResolution`, which `UiLinkResolutionSchema` validates:

| Field                                        | Holds                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `state`                                      | `chip` when a person can open it, `plain` when not                                                      |
| `target`                                     | The canonical target, such as a path made relative; required for a chip                                 |
| `label`                                      | What the host calls it, such as a node's title or a commit's subject                                    |
| `detail`                                     | A second line under the label where the link stands as a row, such as a cited message's sender and date |
| `cwd`, `relativePath`, `viewId`, `projectId` | Where the host opens it                                                                                 |
| `staged`, `conflicted`                       | The state of a changed file                                                                             |
| `code`, `reason`                             | Why a link is plain: a stable code and words                                                            |
| `status`                                     | What the target is doing, where the host knows: `running`, `needsYou` or `done`                         |

`state` is a closed set; `code` is open for host codes. A client words the codes it knows and shows `reason` for others.

`status` is open text too, so a host may send a value this version does not list. A Node chip draws `running`, `needsYou` and `done` as a dot with the state in words, and ignores any other value. Leave it out for a target that has no such state.

A component may link as another one. The catalog says so in its `link`: the name of the target type when the props carry the same names (`Leaf` and `Change`), or `{ type, props }` where they differ, as `CodeBlock` maps `file` to `path` and `start` to `line`.

## The host's part

With `@adecore/agents`, the optional `ChatUiHost.link(info, access, target)` resolves a target against the writing chat's captured access and current scope. Without it, `ui.link` answers plain text with `links-unsupported`.

- When a reply is final, the backend resolves the first `UI_HOST_LIMITS.links` (64) targets of each block with the default input and stores them with the frozen readings.
- `ui.link` resolves one node again for an attached client. The client names the block, node id and input values, never a target. The backend takes the target from the stored block.
- A node that is no longer a visible link answers `link-unsupported`.
- The backend refuses an unparsable resolution, or a chip without a target.

## The page's part

A link reads as plain text until the host answers. In agents-react, `useUiLinks` asks `intelligentUi.link` for visible targets whose inputs or readings changed, and checks the stored node again on every click before calling `intelligentUi.openLink`. `openLink` receives the resolution, not the agent's target, so it opens what the host checked.

## Open diffs

A `<Diff path open>` shows the change of its file inside the block. The agent writes the path and, at most, two revisions. The host reads the change from git, so the block shows what git holds.

The request is `ui.diff`. Its `ChatUiDiffPayload` (`ChatUiDiffPayloadSchema`) has the fields of a link's payload and nothing more: the chat, item, block and revision, the node id, the input values and the read ids. The path and the revisions are not in it. The backend takes them from the stored node, as it takes a link's target.

It answers with a `ChatUiDiffReading` (`ChatUiDiffReadingSchema`):

| Field            | Holds                                                |
| ---------------- | ---------------------------------------------------- |
| `state`          | `patch` when the change was read, `refused` when not |
| `patch`          | The change as a unified patch of the one file        |
| `truncated`      | Set when the patch was cut short                     |
| `code`, `reason` | Why it was refused: a stable code and words          |

`state` is a closed set; `code` is open, like a link's.

With `@adecore/agents`, the optional `ChatUiHost.diff(info, access, request)` reads the change against the writing chat's captured access. The `ChatUiDiffRequest` holds the node's `path`, and its `from`, `to` and `whitespace` where the agent wrote them. Without `from` and `to` the change is the working tree against `HEAD`. `whitespace` is `hide` when lines that differ only in whitespace should be left out; how is up to the host. An agent wrote the path and the revisions, so check them as you check a link target.

```ts
import { ChatUiRefusal, type ChatUiHost } from '@adecore/agents/chat';

const intelligentUi: ChatUiHost = {
    capture: async (info) => ({ cwd: info.cwd }),
    sources: {},
    diff: async (info, access, request) => {
        if (!insideProject(access, request.path)) {
            throw new ChatUiRefusal('outside-project', 'Outside the project.');
        }

        return { patch: await gitDiff(info.cwd, request) };
    }
};
```

- `ui.diff` answers only for an attached client and a stored node that the block draws as an open Diff. Any other node answers `link-unsupported`.
- A host without `diff` answers `diffs-unsupported`.
- The backend sends at most 256 kB of patch, cut on a line, and sets `truncated`. Return `truncated: true` yourself when you cut the change earlier.
- A `ChatUiRefusal` chooses the code and the words; any other error gets a fixed reason.

In agents-react, `intelligentUi.diff(scopeId, payload)` sends the request. A page asks once per open Diff of a finished block, for the first eight of a block, and draws the first 200 lines of the patch. Leave `diff` out and every open Diff stays the chip a closed one is.
