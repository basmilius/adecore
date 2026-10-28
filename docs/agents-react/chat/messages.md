# Messages and code

The renderers the thread draws text with, for a message, a note or a block of output outside it.

```tsx
import { Markdown, MessageMarkdown, ReplyMarkdown } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/markdown" />

## Markdown

Three renderers of GitHub-flavored Markdown with the typography plugin's `prose` styles. None renders raw HTML.

- `MessageMarkdown({ text, mentions?, skills? })` draws what a person sent. Line breaks stay, a typed tag stays text, and picked files and skills become chips.
- `ReplyMarkdown({ text, streaming, arriving? })` draws a reply, parsing one block at a time. While `streaming`, new words fade in and an open code fence highlights as it grows; `arriving` fades in whole blocks instead.
- `Markdown({ text, breaks?, fileLinks?, muted?, rehypePlugins?, componentOverrides? })` draws any other text. `breaks` keeps line breaks, `fileLinks` (on by default) links paths through the host's `fileLinks`, and `muted` dims the text like a thought.

A path becomes a link when the host's `fileLinks.target(text, cwd)` finds one. `FileLinkContext` sets the folder for relative paths; the thread sets it to the chat's `cwd`.

## CodeBlock

A fenced block, highlighted with Shiki in the theme of the host's `code`. The block keeps its size while the grammar loads. An unknown language stays plain text.

<Demo src="agents/code-block" />

```tsx
<CodeBlock code={source} lang="ts" />
```

`useCodeTheme()` returns the theme id in use. `CodeStreamingContext` marks a fence as still open; `ReplyMarkdown` sets it.

`view` replaces the code inside the same frame, such as with what the code draws, while Copy still copies `code`.

Copy copies `code` exactly. The controls show on hover or focus, and always without hover. The optional `actions` node adds your own controls beside Copy. In the chat's own replies, the host's [shell action](/agents-react/guide/host#slots-and-cards) goes there.

## Mermaid diagrams

A ```` ```mermaid ```` fence is drawn as a diagram by [Pele](https://pele.run) (MIT), which reads Mermaid 12.1 syntax. Pele loads lazily with the first closed fence. An open fence shows its source; text Pele cannot draw stays source with a note.

A button beside Copy switches between diagram and source; Copy copies the source either way. The diagram uses the theme's tokens and follows theme changes.

The drawing is an SVG `data:` image without links, images or scripts. A Content Security Policy needs `data:` in `img-src`, and no `'unsafe-eval'`.

## AnsiOutput and FadingWords

`AnsiOutput({ text, limit?, tailLines? })` draws command output with its colors, bold, italics and underlines, and drops other control sequences. `tailLines` keeps the last lines and `limit` the first characters, with a line saying how much was left out. The colors come from the `--term-ansi-*` tokens; see [CSS](/agents-react/guide/getting-started#css).

`FadingWords({ text })` fades in each word as text grows.

<Demo src="agents/ansi-output" />

`parseAnsi(text, options)` and `stripAnsi(text)` are the parser alone. `wordSegments`, `rehypeFadeWords`, `rehypeChips` and `remarkHtmlAsText` are the renderers' plugins. `splitMarkdownBlocks` splits text into `MarkdownBlock`s as `ReplyMarkdown` does; a top-level fence carries a `MarkdownFence` with its marker, info string and body.
