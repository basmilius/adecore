# Links

A File, Diff, Commit or Node in a block names something the host owns. The host decides whether it is a chip a person can open, or plain text. The page never decides whether a path belongs to a project.

## Targets

`uiLinkTargets(block, input?, queries?, limits?)` evaluates a completed block with validated input and lists its visible link targets, by evaluated node id. Hidden, unfinished and invalid nodes are left out, and so are parts inside a `Show` that is false.

```ts
import { uiLinkTargets } from '@adecore/intelligent-ui/links';

const targets = uiLinkTargets(block);
// { 'item-1:ui:0:0': { type: 'File', path: 'src/terminal/links.ts', line: 148 } }
```

A `UiLinkTarget` is one of:

| Target                              | From                     |
| ----------------------------------- | ------------------------ |
| `{ type: 'File', path, line? }`     | `<File path line>`       |
| `{ type: 'Diff', path }`            | `<Diff path>`            |
| `{ type: 'Commit', sha }`           | `<Commit sha>`           |
| `{ type: 'Node', id }`              | `<Node id>`              |

`UiLinkTargetSchema` validates one. A path is at most 4,096 characters and a sha 7 to 64 hexadecimal characters.

## Resolutions

The host answers a target with a `UiLinkResolution`, which `UiLinkResolutionSchema` validates:

| Field           | Holds                                                                |
| --------------- | -------------------------------------------------------------------- |
| `state`         | `chip` when a person can open it, `plain` when not                   |
| `target`        | The canonical target, such as a path made relative; required for a chip |
| `label`         | What the host calls it, such as a node's title or a commit's subject |
| `cwd`, `relativePath`, `viewId`, `projectId` | Where the host opens it                 |
| `staged`, `conflicted` | The state of a changed file                                   |
| `code`, `reason`| Why a link is plain: a stable code and words                         |

`state` is a closed set: a client validates a resolution whole, so a new state would break it. `code` is open, so a host may add codes of its own. A client words a code it knows and shows `reason` for one it does not.

## The host's part

With `@adecore/agents`, `ChatUiHost.link(info, access, target)` resolves a target against the writing chat's captured access and its current scope. It is optional; without it `ui.link` answers plain text with `links-unsupported`.

- When a reply is final, the backend resolves the first `UI_HOST_LIMITS.links` (64) targets of each block with the default input and stores them with the frozen readings. A page draws those at once.
- `ui.link` resolves one node again for a client attached to the chat. The client names the block, the node id and its input values, never a target. The backend validates the input, takes the target from the stored block and asks `link` again.
- A node that is no longer a visible link answers `link-unsupported`.
- A resolution that does not parse, or a chip without a target, is refused.

## The page's part

A link reads as plain text until the host has answered, so it fades into a chip once checked. In agents-react, `useUiLinks` asks `intelligentUi.link` for the visible targets whose inputs or readings changed, and checks the stored node again on every click before it calls `intelligentUi.openLink` with the resolution. `openLink` receives the resolution, not the agent's target, so it opens what the host checked.
