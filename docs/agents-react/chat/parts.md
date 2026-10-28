# Chat parts

Smaller pieces of the thread and composer, for a header, card or chat list of your own. Each reads the chat from its scope.

<Demo src="agents/chat-parts" />

| Component                              | Import                         |                                                                                                       |
| -------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `ChatActivity({ chatId })`             | `@adecore/agents-react/chat/ui` | The line over the composer: the chat's subagents and its background commands, each with a flyout. Nothing while there are none. |
| `StatusIcon({ word })`                 | `@adecore/agents-react/chat/ui` | The mark of a `StatusWord`: `running`, `paused`, `done`, `failed` or `cancelled`.                     |
| `AccountPill({ chatId })`              | `@adecore/agents-react/chat/ui` | The account a chat runs under, only while its CLI has a choice of accounts.                           |
| `UploadThumb({ upload })`              | `@adecore/agents-react/chat/ui` | An image the composer holds, drawn from a thumbnail made in the page.                                 |
| `ImageThumb(props: ImageThumbProps)` | `@adecore/agents-react/chat/ui` | An image that opens in a lightbox. `source` is a `ResourceUrl`; without a URL it shows its `failure`. `aspect` (width over height) reserves its space before the bytes arrive, `actions` go in the lightbox header, and `open` with `onOpenChange` control it. |
| `WelcomeGreeting({ chatId, now? })`    | `@adecore/agents-react/chat/ui` | The greeting over an empty chat, by the part of the day.                                              |

`statusLookOf(word)` returns the icon and tone of a `StatusWord`, and `taskStatusWord(task)` a task's word (`paused` while it waits out a limit).

`imageForDisplay(blob)` from `@adecore/agents-react/images` converts HEIC or HEIF to PNG and returns other blobs as they are. Call it before making a display URL or reading pixels; the decoder loads lazily.

`DisplayImage` from `@adecore/agents-react/chat/ui` takes native image props and decodes HEIC or HEIF when the browser cannot. Remote images must allow cross-origin reads.
