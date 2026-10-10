# Host links

Refer to a resource the host owns: a file, a changed file, a commit or a node. The agent only names the target. The host checks it and decides whether a person can open it; see [Links](/intelligent-ui/host/links).

<Demo src="intelligent-ui/links" />

```ui
<File path="src/terminal/links.ts" line={148}>Cuts a path at a space</File>
<Diff path="src/preload.ts"/>
<Commit sha="a1b2c3d"/>
<Node id="review-notes"/>
```

A link without children is a chip, and may stand inside text. With children it is a row: the chip, and what the agent says about it. Until the host has checked a target, it reads as plain text; a target the host refuses stays text, with the reason in a tooltip.

## File

A file in the project or a worktree.

| Prop   | Type    | Required | Notes                                                |
| ------ | ------- | -------- | ---------------------------------------------------- |
| `path` | string  | Yes      | As the agent knows it, relative or absolute          |
| `line` | integer | No       | From 1; a quoted number is read as a number          |

## Diff

A changed file, opened on its changes.

| Prop   | Type   | Required | Notes |
| ------ | ------ | -------- | ----- |
| `path` | string | Yes      |       |

## Commit

A commit of the repository.

| Prop  | Type   | Required | Notes                          |
| ----- | ------ | -------- | ------------------------------ |
| `sha` | string | Yes      | 7 to 64 hexadecimal characters |

## Node

Anything else the host gives an id, such as a view or a document.

| Prop | Type   | Required | Notes              |
| ---- | ------ | -------- | ------------------ |
| `id` | string | Yes      | 1 to 256 characters |
