# Lexical queries

These answer questions about code with the lexer that typing uses, not a parser, so they work on code that does not compile yet. Each takes a language id, such as `typescript` or `php`.

## Brackets

`scanBrackets(text, language?)` pairs the brackets of a text. It skips strings and comments of the language (`typescript` by default) and returns a `BracketIndex`. `pairs` maps each opener to its closer and back, and `unmatched` holds the offsets of unpaired brackets. Pairs never cross.

```ts
import { scanBrackets } from '@adecore/editor-core';

scanBrackets('call(items[0]').pairs; // Map { 10 => 12, 12 => 10 }
```

`document.matchBracket(offset, language?, limit?)` pairs the bracket at `offset` as `scanBrackets` would, and relexes only what changed since the last call. It returns a `BracketMatch` whose `mate` is the partner's offset, or `undefined` for an unpaired bracket. It returns `undefined` itself where no code bracket stands, such as in a string.

```ts
const document = new DocumentModel('call(items[0])');

document.matchBracket(4); // { mate: 13 }
document.matchBracket(13); // { mate: 4 }
```

With `limit` it lexes at most about that many characters and returns `null` when that was not enough. Asking again continues where it stopped, so a view can spread the work over frames.

## Places in the code

`document.placeAt(offset, language)` returns a `TextPlace`: the `language` at the offset and its `kind`, a `TextPlaceKind` of `code`, `comment` or `string`. It resolves embedded regions, such as the `<script>` (by its `lang`) and `<style>` of a Vue file, `html` in a Vue template, PHP markup and JSX children. Very large documents report the document's language as code.

```ts
const document = new DocumentModel('<template><p>{{ name }}</p></template>\n<script lang="ts">\nconst name = "Ada";\n</script>\n');

document.placeAt(60, 'vue'); // { language: 'typescript', kind: 'code' }
```

A host uses it to decide what applies at the caret, such as templates or comment markers.

## Expressions before a dot

`document.postfixOperands(dot, language)` lists the expressions ending right before the `.` at `dot`, innermost first, as `PostfixOperand` values. `from` is the expression's start, and `statement` is true on the widest one when it starts a statement. Postfix templates, which turn `items.if` into `if (items) {}`, build on it.

It reads JavaScript, TypeScript and PHP code and returns nothing in a string, comment, markup or after a decimal point. It follows operator precedence: `a * b + c` gives `c` and the whole line, never `b + c`. An assignment, a keyword such as `return` or an opening bracket ends the search.

## Surrounding a selection

`document.surroundShape(from, to, language)` tells what a range can be wrapped in. It returns a `SurroundShape`: the trimmed `from` and `to`, `statements` when the range is whole statements, and `expression` when it is one expression on a line. Both ends must be code inside the same bracket. A blank range returns `null`.

## Unwrapping

`document.unwrapTargets(offset, language, indentUnit)` lists what can be unwrapped or removed around an offset in script and PHP code, innermost first, as `UnwrapTarget` values. Each has a `kind`, the construct's `range` and the `edits` that do it. The `UnwrapKind` is one of `if`, `else`, `removeElse`, `for`, `while`, `do`, `try`, `removeCatch`, `removeFinally` or `braces`.

An unwrap keeps the body at the header's indentation and drops the header, the closing brace and the clauses that follow. A `remove` kind drops one clause with its body. `indentUnit` is the indentation removed when a body is not deeper than its header. Functions, classes, object literals and `switch` give no targets.

```ts
const document = new DocumentModel('if (ready) {\n    start();\n}\n');
const [target] = document.unwrapTargets(20, 'typescript', '    ');

document.applyEdits(target.edits);
document.getText(); // 'start();\n'
```

## Comment markers

`commentSyntax(language)` returns the `CommentSyntax` of a language id: its `line` marker and its `block` pair (`open`, `close`), each `null` when the language has none. The comment toggles of [`execute`](/editor-core/commands#comments) use the same table, and a host can use it to write a comment of its own, such as a region marker.

```ts
import { commentSyntax } from '@adecore/editor-core';

commentSyntax('python'); // { line: '#', block: null }
```

## TODO comments

`findTodos(text, language, options?)` returns the TODO comments of a text as `TodoMatch`es: `from` and `to` offsets, the zero-based `line` and the matched `word`. A match starts at one of the `words` of its `TodoOptions` (default `DEFAULT_TODO_WORDS`: `TODO` and `FIXME`), as a whole word in any case inside a comment, and runs to the comment's end on that line. Words in strings or code do not count.

```ts
findTodos('const x = 1; // TODO: rename', 'typescript'); // [{ from: 16, to: 28, line: 0, word: 'TODO' }]
```

`document.findTodos(language, options?, first?, last?)` does the same for lines `first` through `last` of a `DocumentModel`.

## Documentation comments

`findDocComments(text, languageId, limit?)` returns the `/** */` comments that stand on their own lines, as `DocComment`s: `from` and `to` offsets, zero-based inclusive `startLine` and `endLine`, the opener's `indent` and the `body` without delimiters and margin stars. It leaves out comments past `MAX_DOC_COMMENTS` (500, or `limit`). [`@adecore/editor-react`](/editor-react/rendered-documentation) draws them as formatted text.

## Indentation

- `detectIndentation(text)` returns the indentation a text uses as a `DetectedIndentation`: `{ insertSpaces: false }` when tabs dominate, or `{ insertSpaces: true, tabSize }` with the most common level width. It returns `null` when no line tells. A host that prefers the file's indentation over its own setting passes the result as the editor's `indentation` when a file opens.
- `indentationColumn(text, tabSize)` is the column width of `text`, with each tab expanded to the next tab stop. Pass a line's leading whitespace to get its indentation.

```ts
import { detectIndentation, indentationColumn } from '@adecore/editor-core';

detectIndentation('if (a) {\n  b();\n}\n'); // { insertSpaces: true, tabSize: 2 }
indentationColumn('\t  ', 4); // 6
```
