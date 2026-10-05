# Messages and timeline

`Timeline({ chatId, composer?, overlay? })` renders the chat row in the surrounding scope. Give its flex ancestors a usable height and `min-height: 0`; otherwise the scroller cannot measure its viewport. The composer stays at the end of the frame. An overlay covers the thread while preserving the reading position underneath and leaves the composer accessible.

## Rows, streaming, and history

The main timeline virtualizes visible rows with `@tanstack/react-virtual`. It derives rows from `ChatState.structure`, not every text delta. Visible assistant, thought, and live-tool rows read current content separately. Use [state selectors](./chat-lifecycle#read-state-without-relaying-every-streamed-word) when building a custom renderer.

Rows include user/assistant messages, thoughts, notes, running and grouped tools, workflows, child agents, approvals/questions, compaction, turn folds, file changes, forks, and host cards. `deriveTimelineRows(items, options)` groups tools and completed turns using the expanded sets and active turn ID. Unknown tools still render with a generic icon and a string-input summary; a new tool name does not need a custom renderer just to remain visible.

The thread follows new content while the reader is at the end. Opening groups or scrolling back stops that following. Earlier history loads near the top and preserves a reading anchor. A pending prompt can be older than the visible page, so the composer uses the store's complete waiting-request list rather than the visible rows.

`ChatHost.useStreaming()` selects `words`, `blocks`, or `whole`. Stream presentation does not change protocol events or provider output. `ReplyMarkdown` parses blocks separately; an unclosed fence highlights incrementally. Changing to a new Markdown component on every stream update would remount code blocks and lose their local rendering state.

## Render standalone text and output

````tsx
import { MessageMarkdown, ReplyMarkdown, Markdown } from '@adecore/agents-react/chat/ui/Markdown';
import { AnsiOutput } from '@adecore/agents-react/chat/ui/AnsiOutput';

export function RenderingSample() {
    return (
        <section>
            <MessageMarkdown text="Review @src/main.ts with $review" mentions={['src/main.ts']} skills={['review']} />
            <ReplyMarkdown text="The function returns a value.\n\n```ts\nconst value = 1;\n```" streaming={false} />
            <Markdown text="A host note\nwith a line break." breaks fileLinks={false} />
            <AnsiOutput text={'\u001b[32mChecks passed\u001b[0m\n'} tailLines={20} />
        </section>
    );
}
````

`MessageMarkdown` preserves person-authored line breaks and displays literal HTML-like text as text. `ReplyMarkdown` uses the agent's Markdown structure. `Markdown` accepts `breaks`, `fileLinks`, optional rehype plugins, and component overrides for host notes. Do not insert a raw-HTML plugin into a chat renderer without owning the sanitization boundary.

`AnsiOutput` parses rendition sequences into React text and styles, strips other controls, and can limit output or show tail lines. It does not execute terminal controls or OSC links. Its named colors require the terminal palette described in [styling](./styling#theme-tokens).

## File links and images

`FileLinkContext` supplies the working directory for paths in Markdown. `ChatHost.fileLinks.target(text, cwd)` returns `{ path, directory, line? }` or null; `line` is one-based and a trailing separator indicates a directory. `open(cwd, ref)` is the host's authorized navigation action. Without the adapter, paths remain text. The package does not canonicalize or authorize a filesystem target for the host.

Stored message images use `attachments.useUrl`; images read by tools use the optional `ReadImage` component. Attachment resource failures remain visible in the image UI. See [attachments](./attachments#serve-stored-resources).

## Diffs and file changes

`DiffPool` is a default export around the diff renderers. It shares two workers and synchronizes the code theme. The host supplies a bundler-specific worker factory; [styling](./styling#diff-workers-and-lazy-modules) shows Vite's factory.

`EditDiff` is a default export for an edit's old/new content. `UnifiedDiff` is a default export taking `change: ChatFileChange`, with `overflow: 'wrap' | 'scroll'` (default wrap), `diffStyle: 'unified' | 'split'` (default unified), optional `fill`, and optional `contents: { old, new }`. Complete old/new texts allow unfolding outside patch hunks. A patch alone cannot supply unknown surrounding lines.

Diffs present backend-reported changes. They do not write a file. Turn comparisons come from `ChatActions.turnDiff` and can return null when no checkpoint exists. The two lazy diff modules need Suspense/error handling as described in [host adapters](./host#async-ownership).

## Bookmarks, quotes, forks, and find

Bookmarks are backend-owned. `placeBookmark`, `nameBookmark`, and `removeBookmark` call the client and display failures through `notify`; removal offers an undo action. `goToBookmark` returns false when no registered timeline can jump there. Names and lists also arrive over `chat.bookmarks`; local optimistic editing must not replace that shared authority.

The timeline registers quote selection for the composer. A selected answer becomes a quote in the draft; it is not sent until the person submits. Fork actions appear only when `ChatHost.fork` is supplied and the selected turn satisfies `forkRefusal`. `useChatPlace` supplies navigation to other chats and a null title for a missing chat.

Find is host-owned through `useTimelineFind(options)`. The package gives it rows, current structure/order, DOM refs, opening/scrolling callbacks, covered composer height, and a way to stop following. Return a stable `TimelineFind` with the bar, hit rows, current row, and optional `FindReveal` to open a match inside a fold. The default host has no find bar.

`TimelineMenuPopup`, `MessageActions`, `BookmarkMarker`, `BookmarkSubmenu`, and `Scrubber` are available for custom compositions. Use the [chat reference](./reference-chat) to find row renderers and their supporting helpers. Prefer the complete `Timeline` unless the host needs to own its grouping and scroll behavior.
