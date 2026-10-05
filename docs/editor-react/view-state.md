# View state

A file that opens again should open where it was left: scrolled, folded and with the caret on the same line. These helpers keep that in memory, per window, for as long as the page lives. Storing it on disk is the app's choice.

`viewStates` is a `Map` from a key to a `ViewState`: `scrollTop` in pixels, a one-based `line` and `column`, and the `folds` of [`getFolds()`](/editor/find-folding#folding). Use a key the app makes from a namespace, such as the machine or project, and the path: `` `${namespace}:${path}` ``.

```ts
const key = `${machine}:${path}`;

// When the editor closes:
viewStates.set(viewStateKey(key), { scrollTop: editor.getScrollTop(), line: caret.line + 1, column: caret.character + 1, folds: editor.getFolds() });

// When it opens:
forgetMovesFrom(key);
const options = { text, theme, ...openingPlace(reveal, viewStates.get(key), 0, ['imports']) };
```

`openingPlace(reveal, last, placeholderScroll, foldDefaults)` decides the opening options. A `RevealLineRequest` (`{ line }`, such as from go to definition) wins; else the remembered state; else the `placeholderScroll` and the default fold roles. The remembered folds come back either way.

When a file or folder moves, `followViewStates(namespace, from, to)` moves its states along. An editor that is still open on the old path writes its state once more as it closes; `viewStateKey(key)` sends that write to the new path. `forgetMovesFrom(key)` drops that redirect when a new file opens at the old path.
