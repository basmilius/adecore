# Host links

Refer to a resource the host owns: a file, a changed file, a commit or a node. The agent names the target; the host checks it and decides whether a person can open it. See [links](/intelligent-ui/host/links).

<Demo src="intelligent-ui/links" />

```ui
<File path="src/terminal/links.ts" line={148}>Cuts a path at a space</File>
<Diff path="src/preload.ts"/>
<Commit sha="a1b2c3d"/>
<Node id="review-notes"/>
```

A `Change` in a list of changed files, a [`Leaf`](/intelligent-ui/components/structure#tree-branch-and-leaf) with a path and a [`CodeBlock`](/intelligent-ui/components/content#codeblock) with a file are links too, checked the same way.

A link without children is a chip and may stand inside text. With children it is a row of the chip and the agent's note. A target reads as plain text until the host checks it; a refused target stays text, with the reason in a tooltip.

## File

A file in the project or a worktree.

| Prop   | Type    | Required | Notes                                       |
| ------ | ------- | -------- | ------------------------------------------- |
| `path` | string  | Yes      | As the agent knows it, relative or absolute |
| `line` | integer | No       | From 1; a quoted number is read as a number |

## Diff

A changed file, opened on its changes. With `open` the block shows the change itself.

| Prop         | Type    | Required | Notes                                                                                |
| ------------ | ------- | -------- | ------------------------------------------------------------------------------------ |
| `path`       | string  | Yes      |                                                                                      |
| `open`       | boolean | No       | Shows the change in the block, read by the host from git                             |
| `from`       | string  | No       | The revision to compare from; with `to`, in place of the working tree against `HEAD` |
| `to`         | string  | No       | The revision to compare to                                                           |
| `whitespace` | string  | No       | `show` or `hide`; `hide` leaves out lines that differ only in whitespace             |

```ui
<Diff path="src/compiler.ts" open>Reads a number written as text</Diff>
```

The agent writes only the path, so the change shown is the one git holds and costs the agent no tokens. An open Diff is a tile: the chip of the file, the agent's note, and the patch. It shows the first 200 lines of the change; past them a button opens the whole diff, as the chip does. Until the host answers, the chip waits with a spinner. A change the host will not read leaves the path as text, with the reason in a tooltip. A block opens its first eight open Diffs; the rest stay chips, as every open Diff does on a host that [reads no diffs](/intelligent-ui/host/links#open-diffs).

For a change that is not on disk yet, write it in a `<CodeBlock language="diff">`.

## Changes and Change

The files a piece of work changed. `Changes` has no props and holds only `Change`, 1 to 100 of them. A `Change` stands only inside `Changes`; its children are a note on what changed.

| Change prop | Type    | Required | Notes                                       |
| ----------- | ------- | -------- | ------------------------------------------- |
| `path`      | string  | Yes      |                                             |
| `added`     | integer | No       | Lines added, zero or more                   |
| `removed`   | integer | No       | Lines removed, zero or more                 |
| `state`     | string  | No       | `added`, `modified`, `deleted` or `renamed` |

```ui
<Changes>
<Change path="src/compiler.ts" added={48} removed={6}>Reads a number written as text</Change>
<Change path="src/normalize.ts" added={71} state="added"/>
</Changes>
```

Each row shows the file, its state in a word, the lines added and removed, and a small bar of the two. A Change is a link like a Diff: the host checks its path, and the row opens the file's diff once the host says it can. A path it cannot open stays text, with the reason in a tooltip.

## Commit

A commit of the repository.

| Prop  | Type   | Required | Notes                          |
| ----- | ------ | -------- | ------------------------------ |
| `sha` | string | Yes      | 7 to 64 hexadecimal characters |

## Node

Anything else the host gives an id, such as a view or a document.

| Prop | Type   | Required | Notes               |
| ---- | ------ | -------- | ------------------- |
| `id` | string | Yes      | 1 to 256 characters |

Where the host knows what a node is doing, such as an agent or a chat, the chip shows a dot for running, needs you or done, with the state in its tooltip. The agent writes nothing for it.
