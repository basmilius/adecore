# Search

A `DocumentModel` finds and replaces in its own text. The same search runs on a plain string through four functions, for a worker or a host without a model.

## Find

`find(query, options?)` returns every `FindMatch` in the document: `from`, `to`, `text`, the regular expression's `captures` and named `groups`, and the `revision` it was found in.

```ts
const document = new DocumentModel('Name: Ada, Name: Grace');

document.find('Name: (\\w+)', { regex: true }).map((match) => match.captures);
// [['Ada'], ['Grace']]
```

`findNext(query, from?, options?)` returns the first match at or after `from`, the primary caret by default. It takes `FindNextOptions`. It wraps around unless `wrap` is `false`, and `backwards: true` searches the other way.

| `FindOptions`   | Default | Meaning                                                                      |
| --------------- | ------- | ---------------------------------------------------------------------------- |
| `caseSensitive` | `false` |                                                                              |
| `wholeWord`     | `false` | A match may not touch a letter, digit, `_` or `$` on either side             |
| `regex`         | `false` | The query is a JavaScript regular expression, run with the `m` and `u` flags |
| `from`, `to`    | whole   | Keep only matches inside these offsets; the expression still sees the rest   |
| `maxResults`    | none    | Stop after this many                                                         |

An empty plain query finds nothing. Bounds outside the document throw a `RangeError` and an invalid expression a `SyntaxError`. A regular expression has no time limit, so run untrusted patterns in a worker.

## Replace

`replace(match, replacement, options?)` replaces one match. It returns `false` and changes nothing when the match is from another revision or its text changed. `replaceAll(query, replacement, options?)` replaces every match in one undo step and returns the count. Its `ReplaceAllOptions` are the find options plus the replace options below.

```ts
const document = new DocumentModel('Item one, item two, ITEM three');

document.replaceAll('item', 'entry', { preserveCase: true });
document.getText(); // 'Entry one, entry two, ENTRY three'
```

`replaceMatches(matches, replacement, options?)` replaces results kept from one search, such as an asynchronous one, in one undo step and returns the count. It takes `ReplaceOptions`. If any result is stale, it refuses the whole batch. Duplicate or overlapping results throw before any change, as in `applyEdits`.

With a regular expression the replacement expands `$1`, `$<name>`, `$&` and the other JavaScript patterns. `literal: true` turns that off. `preserveCase: true` matches the case of the replaced text. `ReplaceOptions` also take the [edit options](/editor-core/documents#edits), such as `expectedRevision`.

## Without a model

These take the text and a revision number, which ends up in each `FindMatch` so a later replace can tell stale results apart.

- `iterateMatches(text, query, revision, options?)` yields the results lazily. Validation starts on the first advance, and stopping early skips the rest of the scan.
- `findMatches(text, query, revision, options?)` collects them into an array.
- `findMatchFrom(text, query, revision, offset, options?)` is the standalone `findNext`. It clamps `offset` and respects `maxResults`, `backwards` and `wrap`.
- `replacementText(text, match, replacement, literal?, preserveCase?, maxCharacters?)` expands a replacement for one match the way `replace` does. It throws a `RangeError` when the expanded output would exceed `maxCharacters`.

```ts
import { findMatches } from '@adecore/editor-core';

findMatches('aaaa', 'aa', 1).map((match) => [match.from, match.to]); // [[0, 2], [2, 4]]
```

Matches never overlap: searching `aa` in `aaaa` from offset 1 returns `[2, 4]`, not `[1, 3]`. The search worker of [`@adecore/editor`](/editor/find#search-worker) runs `iterateMatches` off the page.
