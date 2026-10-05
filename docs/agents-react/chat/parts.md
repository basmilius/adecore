# Chat parts

The smaller pieces the thread and the composer are made of, exported for a header, a card or a list of chats of your own. Each reads the chat from the scope it is rendered in.

<Demo src="agents/chat-parts" />

| Component                              | Import                         |                                                                                                       |
| -------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `ChatActivity({ chatId })`             | `chat/ui/ChatActivity`         | The line over the composer: the chat's subagents and its background commands, each with a flyout. Nothing while there are none. |
| `StatusIcon({ word })`                 | `chat/ui/ChatActivity`         | The mark of a `StatusWord`: `running`, `paused`, `done`, `failed` or `cancelled`.                     |
| `AccountPill({ chatId })`              | `chat/ui/AccountPill`          | The account a chat runs under, only while its CLI has a choice of accounts.                           |
| `ChatReferenceChip({ chatId, onRemove? })` | `chat/ui/ChatReferenceChip` | Another chat a message points at, under the title `useReferableChats` gives it now.                   |
| `UploadThumb({ upload })`              | `chat/ui/UploadThumb`          | An image the composer holds, drawn from a thumbnail made in the page.                                 |
| `ImageThumb({ source, alt, className? })` | `chat/ui/ImageView`         | An image that opens large in a lightbox. `source` is a `ResourceUrl`; without a URL it shows its `failure`. |
| `WelcomeGreeting({ chatId, now? })`    | `chat/ui/Welcome`              | The greeting over an empty chat, by the part of the day.                                              |

`statusLookOf(word)` answers the icon and tone of a `StatusWord`, and `taskStatusWord(task)` the word of a task, `paused` for an open task waiting out a limit. `backgroundCounts(tasks)` counts the shells and monitors of `info.background`. `useUploadThumbnail(upload)` makes the thumbnail `UploadThumb` draws, at most `THUMBNAIL_PX` (256) pixels.
