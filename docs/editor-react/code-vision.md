# Code vision

Rows above each declaration show how often it is used and who wrote it. Pressing the usages opens a [peek](/editor-react/navigation#peek) of the references; pressing the authors opens a card.

<Demo src="editor/code-vision" />

Both kinds are off until the app turns them on:

```ts
language.codeVision.configure({ usages: true, authors: true });
```

Usages come from `textDocument/references` for the declarations in and near the view, once text and scroll settle. Declarations come from the document's symbols.

Authors come from Git, which the package never runs. The app runs `git blame` on the file on disk and passes the result with that text as `base`:

```ts
language.codeVision.setBlame({ kind: 'pending' }); // holds the rows' height while Git runs
language.codeVision.setBlame({ kind: 'ready', blame, base: textOnDisk, openCommit: (hash) => showCommit(hash) });
```

A `GitBlameResult` has the `commits` (`hash`, `shortHash`, `author`, `email`, `at` in milliseconds, `summary`) and `lines`, the commit index of each line of `base`. `omitted: 'untracked'` or `'too-large'` says why there is no blame. Lines typed since count as uncommitted. `setBlame(null)` removes the authors.

The card lists the declaration's authors by lines written, the uncommitted lines and the latest commit, with a button to it when `openCommit` is set.

Files over 20,000 lines or 3,000 declarations get no rows.
