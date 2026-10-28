# Links

A File, Diff, Commit or Node in a block names something the host owns. The host decides whether it becomes a chip a person can open or stays plain text.

## Targets

`uiLinkTargets(block, input?, queries?, limits?)` evaluates a completed block with validated input and lists its visible link targets by node id. Hidden, unfinished and invalid nodes are left out.

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

`state` is a closed set; `code` is open for host codes. A client words the codes it knows and shows `reason` for others.

## The host's part

With `@adecore/agents`, the optional `ChatUiHost.link(info, access, target)` resolves a target against the writing chat's captured access and current scope. Without it, `ui.link` answers plain text with `links-unsupported`.

- When a reply is final, the backend resolves the first `UI_HOST_LIMITS.links` (64) targets of each block with the default input and stores them with the frozen readings.
- `ui.link` resolves one node again for an attached client. The client names the block, node id and input values, never a target. The backend takes the target from the stored block.
- A node that is no longer a visible link answers `link-unsupported`.
- An unparsable resolution, or a chip without a target, is refused.

## The page's part

A link reads as plain text until the host answers. In agents-react, `useUiLinks` asks `intelligentUi.link` for visible targets whose inputs or readings changed, and checks the stored node again on every click before calling `intelligentUi.openLink`. `openLink` receives the resolution, not the agent's target, so it opens what the host checked.
