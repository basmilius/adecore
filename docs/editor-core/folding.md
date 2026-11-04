# Folding

The model lists the ranges a view can fold. It keeps no fold state itself. The view tracks which ranges are collapsed.

## Folding ranges

`getFoldingRanges(options?)` returns the document's folds as `FoldingRange`s. Without options it returns multiline bracket pairs and block comments. Pass a `language` for the rest:

| `kind`          | What folds                                                                      | Needs               |
| --------------- | ------------------------------------------------------------------------------- | ------------------- |
| `bracket`       | A `{}`, `[]` or `()` pair over several lines                                    |                     |
| `comment`       | A block comment                                                                 |                     |
| `indentation`   | Lines indented deeper than the one above them                                   | `indentation: true` |
| `imports`       | A run of import lines                                                           | a language          |
| `line-comments` | A run of line comments                                                          | a language          |
| `region`        | What stands between `// region` and `// endregion` markers                      | a language          |
| `block`         | A Markdown front matter, code fence or table, a PHP heredoc or `<?php ?>` block | a language          |
| `section`       | What a Markdown heading holds                                                   | a language          |
| `server`        | A range a language server named that the text has no fold for                   | `hints`             |

`FoldingOptions` turn one kind off with `false`: `brackets`, `comments`, `imports`, `regions` and `lineComments`. `minLines` (default `1`) is how many lines past its first a range must span, and `tabSize` measures indentation. Lines are zero-based and inclusive. `from` and `to` are the offsets of the folded stretch.

```ts
const document = new DocumentModel('import { a } from "a";\nimport { b } from "b";\n\nconst list = [\n    1,\n    2\n];\n');

document.getFoldingRanges({ language: 'typescript' }).map((range) => [range.kind, range.role, range.startLine, range.endLine]);
// [['imports', 'imports', 0, 1], ['bracket', 'array-literal', 3, 6]]
```

## Roles

A range may carry a `role`, a `FoldRole` that says what it is. A view uses it to fold certain ranges when a file opens, such as the imports and the file header. The scanner finds:

- `file-header`, the first comment of a file, and `doc-comment`.
- `imports` and `region`.
- `object-literal` and `array-literal`, in TypeScript and JavaScript.
- `attribute` (a PHP `#[` list), `php-tag` and `heredoc`.
- `front-matter`, `code-fence` and `table`, in Markdown.

`function-body`, `method-body`, `class-body` and `tag` need to know what a range belongs to, which a lexical scan cannot tell. They come from hints.

## Hints from a language server

`hints` is a `FoldHints` with two lists, in offsets of the text, which a host fills from a language server's symbols and folding ranges:

- `symbols` are `FoldSymbolHint`s: the `from` and `to` of a symbol and its `body`, one of `function`, `method`, `class` or `value`. A symbol hint names the bracket pair or indented block that ends where the symbol ends. A `value` whose initializer is a function gets a function body.
- `ranges` are `FoldRangeHint`s: a `from` and `to`, the LSP `kind`, and optional `head` and `tail` offsets from the protocol's `startCharacter` and `endCharacter`. A range hint without a matching fold becomes a `server` range.

```ts
const text = 'function total(items) {\n    return items.length;\n}\n';
const document = new DocumentModel(text);

document.getFoldingRanges({
    language: 'typescript',
    hints: { symbols: [{ from: 0, to: 50, body: 'function' }] }
});
// [{ startLine: 0, endLine: 2, kind: 'bracket', role: 'function-body', from: 22, to: 50 }]
```

A range with `head` and `tail` folds within its first and last lines rather than whole lines, so a list of imports can collapse to its first word. [Folding in the editor](/editor/folding) shows how the view uses all of this.
