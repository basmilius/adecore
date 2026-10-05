# Timeline

The thread of one chat, with the composer docked under it. It reads the chat from the store of the scope it is rendered in, so it needs a [`ChatScopeContext`](/agents-react/guide/getting-started#a-scope) and a chat that was opened there.

```tsx
import { Timeline } from '@adecore/agents-react/chat/ui/Timeline';
```

<Demo src="agents/chat" />

```tsx
<Timeline chatId={chatId} composer={<Composer chatId={chatId} info={info} {...composerProps} />} />
```

The timeline fills its parent and scrolls on its own; every flex parent down to it needs `min-h-0`, or it has no height to measure. A chat with nothing in it shows which model answers and the folder it works in, or a greeting when the host's `useWelcome` says so.

## What it draws

The items become rows. Tool calls in a row fold into one line ("Read 2 files"), a finished turn folds behind how long it worked and what it did, the files a turn changed gather in one card under its reply, and a subagent's own work hangs under its row. A tool the package has no word for still draws, with a wrench and the first string of its input.

Only the rows on screen are drawn. The thread follows new text while it is scrolled to the end and stops once a person scrolls up or opens a fold. Near the top it loads the page before the oldest it holds and keeps the row being read in place. Once a thread has a few messages, a scrubber along its edge marks every message and bookmark.

A message has its actions under it on hover: bookmark, fork (only with a host `fork`) and copy. A right click adds copying the message, its code or its Markdown, and selecting text in a reply offers to quote it into the composer. A bookmark marks its message with a line across the thread.

## Props

| Prop      | Type        |                                                                                                    |
| --------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `chatId`  | `string`    | The chat in the scope.                                                                             |
| `composer` | `ReactNode` | Docked at the bottom of the frame, over the end of the thread.                                    |
| `overlay` | `ReactNode` | Stands in the thread's place, down to the composer. The thread keeps its place underneath and the composer stays usable. |

The overlay is where a subagent's conversation goes. A row's open button sets the chat's trail (`useSubagentTrail`); draw a [`SubagentTimeline`](/agents-react/chat/subagents) for its last step, as the demo above does:

```tsx
const { trail } = useSubagentTrail(chatId);
const open = trail.at(-1);

<Timeline chatId={chatId} composer={composer} overlay={open && <SubagentTimeline key={open.toolUseId} chatId={chatId} toolUseId={open.toolUseId} />} />;
```

## Streaming

`useStreaming()` on the host picks how a reply appears: a word at a time with a fade (`words`), a Markdown block at a time (`blocks`), or all at once when it is done (`whole`). A code fence that is still open is highlighted line by line as it grows. Only the row of the growing reply redraws for a word; see [reading the stores](/agents-react/guide/chat-client#reading-the-stores).

## Find

The thread has no find of its own. The host's `useTimelineFind(options)` gets the rows, the refs of the frame, the thread and the scroller, and callbacks to open a fold and scroll to a row, and answers a `TimelineFind`: the bar to draw over the thread, the rows of the hits and the current one. `FindReveal` and `useOpenForFind` let a fold open for a hit inside it.

## Rows

`Row` draws one `TimelineRow`, and the components it picks from are exported for a thread of your own: `UserRow`, `AssistantRow`, `ThinkingRow`, `ReportRow`, `ReplyHeader`, `NoteRow`, `AgentTurnRow`, `CompactionRow`, `ApprovalHistoryRow` and `QuestionHistoryRow` in `chat/ui/rows/MessageRows`; `WorkRow`, `WorkLiveRow`, `WorkGroupRow`, `WorkingRow`, `RunningFor`, `TurnFoldRow`, `ChangedFilesRow` and `ToggleLine` in `chat/ui/rows/WorkRows`; `SubagentRow`, `SubagentBranchRow`, `TaskRow`, `WorkflowRow` and `ForksRow` in files of their own. `deriveTimelineRows(items, options)` turns items into rows the way the timeline does.

<Demo src="agents/rows" />

The menus and markers are exported too: `TimelineMenuPopup` (the right click menu), `MessageActions`, `BookmarkMarker`, `BookmarkSubmenu`, `BookmarkMenuItems`, `QuoteButton` and `Scrubber`. Prefer the whole `Timeline` unless your app owns the grouping and the scrolling.
