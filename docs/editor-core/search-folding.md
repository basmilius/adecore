# Search and folding

## Find

`find(query, options?)` returns every `FindMatch` in the document: `from`, `to`, `text`, the regular expression's `captures` and named `groups`, and the `revision` it was found in. `findNext(query, from?, options?)` returns the first match at or after `from`, the primary caret by default, and wraps around unless `wrap` is `false`; `backwards: true` searches the other way.

| `FindOptions`   | Default | Meaning                                                                      |
| --------------- | ------- | ---------------------------------------------------------------------------- |
| `caseSensitive` | `false` |                                                                              |
| `wholeWord`     | `false` | A match may not touch a letter, digit, `_` or `$` on either side             |
| `regex`         | `false` | The query is a JavaScript regular expression, run with the `m` and `u` flags |
| `from`, `to`    | whole   | Keep only matches inside these offsets; the expression still sees the rest   |
| `maxResults`    | none    | Stop after this many                                                         |

`iterateMatches(text, query, revision, options?)` yields the same results lazily. Validation starts on the first advance, and stopping early skips the rest of the scan. `findMatches` collects them into an array.

`findMatchFrom(text, query, revision, offset, options?)` is the standalone `findNext`. It clamps `offset` and respects `maxResults`, `backwards` and `wrap`. Matches never overlap: searching `aa` in `aaaa` from offset 1 returns `[2, 4]`, not `[1, 3]`.

An empty plain query finds nothing. Bounds outside the document throw a `RangeError` and an invalid expression a `SyntaxError`. A regular expression has no time limit.

## Replace

`replace(match, replacement, options?)` replaces one match. It returns `false` and changes nothing when the match is from another revision or its text changed. `replaceAll(query, replacement, options?)` replaces every match in one undo step and returns the count.

```ts
const document = new DocumentModel('Item one, item two, ITEM three');

document.replaceAll('item', 'entry', { preserveCase: true });
document.getText(); // 'Entry one, entry two, ENTRY three'
```

`replaceMatches(matches, replacement, options?)` replaces results kept from one search, such as an asynchronous one, in one undo step and returns the count. It takes `ReplaceOptions`. If any result is stale, it refuses the whole batch. Duplicate or overlapping results throw before any change, as in `applyEdits`.

With a regular expression the replacement expands `$1`, `$<name>`, `$&` and the other JavaScript patterns. `literal: true` turns that off. `preserveCase: true` matches the case of the replaced text. `findMatches` and `replacementText` do the same search and expansion without a model.

## Folding ranges

`getFoldingRanges(options?)` returns the document's folds. Without options it returns multiline bracket pairs and block comments. Pass a `language` for the rest:

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

`brackets`, `comments`, `imports`, `regions` and `lineComments` turn one kind off with `false`. `minLines` (default `1`) is how many lines past its first a range must span. Lines are zero-based and inclusive. `from` and `to` are the offsets of the folded stretch.

## Roles

A range may carry a `role`, which a view uses to fold certain ranges when a file opens. The scanner finds `file-header` (the first comment of a file), `imports`, `doc-comment`, `region`, `object-literal` and `array-literal` (in TypeScript and JavaScript), `attribute` (a PHP `#[` list), `php-tag`, `heredoc`, `front-matter`, `code-fence` and `table`. `function-body`, `method-body`, `class-body` and `tag` come from `hints`, which a host fills from a language server's symbols and folding ranges:

```ts
const text = 'function total(items) {\n    return items.length;\n}\n';
const document = new DocumentModel(text);

document.getFoldingRanges({
    language: 'typescript',
    hints: { symbols: [{ from: 0, to: 50, body: 'function' }] }
});
// [{ startLine: 0, endLine: 2, kind: 'bracket', role: 'function-body', from: 22, to: 50 }]
```

A symbol hint names the bracket pair or indented block that ends where the symbol ends. A range hint without a matching fold becomes a `server` range.
