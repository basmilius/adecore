# Content

Include code, attachments and sources. Nothing here loads an address or reads a path. `Image`, `Gallery`, `Compare` and `Model` take only attachments the chat already holds; the host tells the agent how to attach its own files. A source opens only when a person clicks it.

<Demo src="intelligent-ui/content" />

```ui
<CodeBlock language="ts">export const retries = 3;</CodeBlock>
<CodeBlock file="src/total.ts" start={12} highlight={[13]}>
const rows = await read();
const total = rows.length;
</CodeBlock>
<Image generated="latest" alt="The new onboarding screen">The first screen after sign up</Image>
<Sources>
<Source title="Node.js release schedule" url="https://nodejs.org/en/about/previous-releases"/>
<Source title="Bun runtime" url="https://bun.sh/docs"/>
</Sources>
```

## CodeBlock

Code as text, without execution. Its contents are literal: angle brackets, braces and `$` stay as written, up to `</CodeBlock>`.

| Prop        | Type              | Required | Notes                                  |
| ----------- | ----------------- | -------- | -------------------------------------- |
| `language`  | string            | No       | For highlighting, such as `ts` or `sh` |
| `file`      | string            | No       | The file the code stands in            |
| `start`     | integer           | No       | The number of the first line, from 1   |
| `highlight` | array of integers | No       | The line numbers to mark, at most 64   |

With `file`, the head shows the file as a chip in place of the language. The host checks the path like any [link](/intelligent-ui/host/links): the chip opens the file at `start` once the host says it can, and stays text when not. Without `language`, the extension of the file picks the highlighting.

With `start`, every line shows its number, counted from there. `highlight` marks lines by those numbers, or counted from 1 without `start`. A selection never copies a line number.

## Quote

Words quoted from a log, a message or a source. Its children are the words, shown as written. Stars and underscores stay what they are.

| Prop     | Type     | Required | Notes                                                                     |
| -------- | -------- | -------- | ------------------------------------------------------------------------- |
| `tone`   | `UiTone` | No       | The color of the bar beside the words; a screen reader hears it as a word |
| `source` | string   | No       | Where the words come from, in a faint line under them                     |
| `mono`   | boolean  | No       | Keeps the words in the code font, with their line breaks                  |

```ui
<Quote tone="danger" source="The build log" mono>error TS2362: the left-hand side must be a number</Quote>
```

For code a person may copy or run, use a `CodeBlock`. A Quote is for what someone or something said.

## Keys

A keyboard shortcut in a sentence. `Keys` has no props; its children are the keys, joined with `+`.

```ui
Open the palette with <Keys>mod+K</Keys> and close a panel with <Keys>Escape</Keys>.
```

`mod` is Command on a Mac and Control elsewhere, and the keys print the way the reader's platform writes them: `⌘K` or `Ctrl` `K`. `ctrl`, `alt`, `shift` and `meta` name those keys, in any case, as do `enter`, `escape`, `tab`, `space`, `backspace`, `delete` and the arrows (`up`, `left`). Keys that form no single shortcut, such as `g+g`, print as written. Keys may stand inside a Summary, a Callout or any other text.

## Image

A chat attachment with an optional caption as its children. Give exactly one of `attachment` and `generated`.

| Prop         | Type     | Required | Notes                                           |
| ------------ | -------- | -------- | ----------------------------------------------- |
| `attachment` | string   | One of   | The id of an attachment of the chat             |
| `generated`  | `latest` | One of   | The image the agent generated last in this turn |
| `alt`        | string   | No       | The text for a screen reader                    |

`generated="latest"` becomes an `attachment` once the backend knows which image it is (`latestAttachment` on [compile](/intelligent-ui/host/compilation)). An Image never takes a URL or a filesystem path.

## Gallery

A grid of images with captions. `Gallery` has no props and holds only `Image`, one to 24 of them; the compiler refuses more. After `Each` or `Show`, a `Gallery` that draws none fails as a whole, and one that draws more than 24 shows the first 24 with `too_many_children`. Each `Image` follows the rules above.

```ui
<Gallery>
<Image attachment="login" alt="Login">Login</Image>
<Image attachment="home" alt="Home">Home</Image>
</Gallery>
```

A cell opens the image large. An image whose attachment is gone shows its alt text.

## Compare

Two attachments in one frame, with a handle between them that a person drags or moves with the arrow keys. Its children are the caption.

| Prop          | Type   | Required | Notes                                             |
| ------------- | ------ | -------- | ------------------------------------------------- |
| `before`      | string | Yes      | The id of an attachment, shown left of the handle |
| `after`       | string | Yes      | The id of an attachment, shown right of it        |
| `beforeLabel` | string | No       | Written on the left half; `Before` without it     |
| `afterLabel`  | string | No       | Written on the right half; `After` without it     |

```ui
<Compare before="old" after="new" beforeLabel="Old" afterLabel="New">The header after the color change</Compare>
```

With one attachment gone, the other shows alone and says so. The handle position is not block state. Its fallback is `[Compare: Old a1, New a2] caption`.

## Model

A 3D model from a chat attachment that a person can orbit and zoom. Its children are the caption. Show one only when the person asks to see a model, never unprompted after writing or changing one.

| Prop         | Type   | Required | Notes                               |
| ------------ | ------ | -------- | ----------------------------------- |
| `attachment` | string | Yes      | The id of an attachment of the chat |
| `alt`        | string | No       | The text for a screen reader        |

```ui
<Model attachment="bracket" alt="Mounting bracket">The bracket after the wall was made thicker</Model>
```

The host draws the model; the catalog knows no file format. A host without a model view shows a row with the name and caption. Its fallback is `[Model: Mounting bracket] caption`.

## Sources and Source

Numbered sources, which prose in the block can cite as `[1]`. `Sources` has no props and holds only `Source`. A `Source` stands only inside `Sources` and has no children.

| Prop    | Type   | Required | Notes                                          |
| ------- | ------ | -------- | ---------------------------------------------- |
| `title` | string | Yes      |                                                |
| `url`   | string | One of   | Starts with `http://` or `https://`            |
| `node`  | string | One of   | The id of a host node, such as a cited message |

A source gives `url` or `node`, never both. A renderer never preloads a source; it opens one through the host on click. A truncated domain reads whole in the row's tooltip.

A `node` source is a link target like [`Node`](/intelligent-ui/components/links#node): the host checks it and opens it through `link` and `openLink`. Its row shows the host's `label` in place of the title and the host's `detail` as a second line, where the host gives them.

```ui
Three conversations wait for your reply [1] [2].
<Sources>
<Source title="Review requested: new onboarding flow" node="mail:onboarding"/>
<Source title="Re: Q1 roadmap planning" node="mail:roadmap"/>
</Sources>
```
