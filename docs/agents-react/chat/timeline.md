# Timeline

The thread of one chat, with the composer docked under it. It needs a [`ChatScopeContext`](/agents-react/guide/getting-started#a-scope) and a chat opened in that scope.

```tsx
import { Timeline } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/chat" />

```tsx
<Timeline chatId={chatId} composer={<Composer chatId={chatId} info={info} {...composerProps} />} />
```

The timeline fills its parent and scrolls on its own. Every flex parent down to it needs `min-h-0`, or it has no height. An empty chat shows the model and folder, or a greeting when the host's `useWelcome` says so.

## What it draws

- Consecutive tool calls fold into one line ("Read 2 files"). A finished turn folds behind its duration and a summary.
- The files a turn changed gather in one card under its reply. A subagent's work hangs under its row.
- A page an agent published stands above its reply when the host draws [visuals](/agents-react/chat/visuals).
- A folded thought shows its heading. While a turn runs, its latest thought stands over the call it led to.
- An unknown tool draws with a wrench and the first string of its input.
- An opened call shows its input (a shell command as itself, other input as `key value` lines) and its output in muted monospace. A failure shows in the error color or names the exit code.
- A shell command draws in the code theme, and code embedded in it (`bash -lc`, `python3 -c`, a heredoc) in its own language. `embeddedCode(command)` finds those stretches.
- A long path is cut in the middle ([`MiddleTruncate`](/ui/display/middle-truncate)), with the whole path on a tooltip.

Only the rows on screen are drawn. The thread follows new text while scrolled to the end and loads older pages near the top. A scrubber along the edge marks every message and bookmark.

Hovering a message shows bookmark, fork (with a host `fork`) and copy. A right click adds copy as code or Markdown, and the reading width in a view of its own. Selecting text in a reply offers to quote it into the composer.

### Programs as tools

A shell call reads as `Bash` and its command. To draw a program of your own as a tool, hand the host a `commandLooks` list with one `CommandLook` per program. A call that runs it shows its `Mark`, its `brand`, the label `describe` returns and the command from word `detailFrom` on.

```tsx
import type { CommandLook } from '@adecore/agents-react';

const DEPLOY: CommandLook = {
    program: 'deploy',
    brand: 'Deploy',
    Mark: ({ size }) => <RocketIcon size={size} />,
    describe: ([target]) =>
        target === undefined
            ? null
            : {
                  label: target === 'preview' ? 'Preview' : 'Production',
                  detailFrom: 1,
                  group: { key: target, sentence: (count) => `Deployed ${count} times` },
                  fold: ['--message'],
                  languages: { '--query': 'sql' }
              },
    useNames: () => (word, option) => (word === 'web-1' && option === '--site' ? { name: 'Website' } : null)
};
```

A program matches only where the shell runs it, by its last path segment, so `grep deploy` stays a shell call. So does a command longer than `EMBEDDED_CODE_LIMIT`. The other programs of the line follow in a tag (`+ sleep, grep`).

- `fold` options get their value shortened, `languages` options get it highlighted.
- `useNames` is a hook. Its function gets each non-option word with the option before it, and may return a display name. The word stays on a tooltip and in find.
- Calls of one look with the same `group.key` read as that group's `sentence`. Calls under different keys use the look's own `sentence`.

The opened call still shows the whole command. `matchCommandLook(command, looks)` returns what a row draws, for a find of your own.

## Reading width

Inside a parent with the class `chat-column`, the rows and composer stand in a centered column. Its width is the person's reading width in the [chat preferences](/agents-react/guide/persistence): `narrow` (640px), `comfortable` (768px, default) or `full`. The right click menu offers them; a settings page can too, with `CHAT_READING_WIDTHS`, `readingWidthLabel`, `readingWidthHint` and `rememberReadingWidth` from `@adecore/agents-react/chat`. Without `chat-column` the thread takes the width it has. `SubagentTimeline` follows the same width.

## Props

| Prop      | Type        |                                                                                                    |
| --------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `chatId`  | `string`    | The chat in the scope.                                                                             |
| `composer` | `ReactNode` | Docked at the bottom of the frame, over the end of the thread.                                    |
| `overlay` | `ReactNode` | Covers the thread down to the composer. The thread keeps its scroll position and the composer stays usable. |

The overlay is where a subagent's conversation goes. A row's open button sets the chat's trail (`useSubagentTrail`); draw a [`SubagentTimeline`](/agents-react/chat/subagents) for its last step:

```tsx
const { trail } = useSubagentTrail(chatId);
const open = trail.at(-1);

<Timeline chatId={chatId} composer={composer} overlay={open && <SubagentTimeline key={open.toolUseId} chatId={chatId} toolUseId={open.toolUseId} />} />;
```

## File references

A `FileRef` has a `path`, an optional one-based `line` and `column`, an inclusive `endLine` and `directory`. The host's `fileLinks.target(text, cwd, scopeId)` and `fileLinks.open(cwd, ref, scopeId)` get the thread's scope, or `null` outside a `ChatScopeContext`.

A file link records its place, scope and cwd for `readTimelineTarget`, so the menu opens what the link pointed at even after the cwd changed. A subagent's conversation uses its own cwd. `useFileLinkCwd()` reads the cwd for a renderer of your own, and `openFileLink(cwd, ref, scopeId)` hands a link to the host. `EMPTY_TARGET` is the `TimelineTarget` of a menu opened on nothing.

## Streaming

The host's `useStreaming()` picks how a reply appears: a word at a time with a fade (`words`), a Markdown block at a time (`blocks`), or all at once (`whole`). An open code fence highlights as it grows. Only the growing reply's row redraws; see [reading the stores](/agents-react/guide/chat-client#reading-the-stores).

## Find

The thread has no find of its own. The host's `useTimelineFind(options)` gets the rows, refs to the frame, thread and scroller, and callbacks to open a fold and scroll to a row. It returns a `TimelineFind` with the bar to draw, the hit rows and the current hit. The options object stays stable until the rows change, so an effect may depend on it. A `FindReveal` opens a fold for a hit inside it.

## Rows

The `Timeline` draws each `TimelineRow` itself. These rows are exported from `@adecore/agents-react/chat/ui`: `AssistantRow`, `ReportRow`, `NoteRow`, `AgentTurnRow`, `CompactionRow`, `WorkRow`, `WorkGroupRow`, `WorkingRow`, `TaskRow`, `WorkflowRow` and `ForksRow`. A workflow's agent line is exported as `WorkflowAgentLine`, for a column of phases of your own ([subagents](/agents-react/chat/subagents#workflows)). `deriveTimelineRows(items, options)` turns items into rows as the timeline does.

<Demo src="agents/rows" />

`WorkRow` takes an optional `icon`, `label` and `failed` to name a call in your own words.

### Generated images

`GeneratedImageRow({ chatId, tool })` draws a tool call named `ImageGeneration` (`IMAGE_GENERATION_TOOL`). It stays out of tool groups and out of a finished turn's fold. The row shows the image's size and dimensions over a thumbnail that opens in the lightbox. Its menu copies the revised prompt and holds the host's `attachments.actions`. Open and Save to project come from the host's [`attachments`](/agents-react/chat/attachments#stored-files) and are left out without them. Missing bytes leave an empty square with the reason on a tooltip.

A failure is a failed tool line with the reason. `generatedImageView(tool)` returns `generating`, `failed` or `ready`, and `attachmentAspect(attachment)` the width over height.

<Demo src="agents/generated-image" />

`TimelineMenuPopup` is the right click menu. Prefer the whole `Timeline` unless your app owns grouping and scrolling.
