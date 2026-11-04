# Editor views

`@adecore/editor-react` adds language features to [`@adecore/editor`](/editor/) over a [`LanguageService`](/lsp/language-service), with the React cards that show them. It also draws diffs and reviews of what an agent proposed. The package starts no language server and touches no file. The app hands it a service and the file operations it allows.

```tsx
import { EditorView, ProjectLanguage } from '@adecore/editor-react';

const project = new ProjectLanguage(service, { folder: '/shop', keymap, openPlace });

<EditorView engine={engine} options={options} project={project} uri="file:///shop/src/order.ts" languageId="typescript" className="h-96" />;
```

<Demo src="editor/language-editor" fill />

The demos run over [`FakeLanguageService`](/editor-react/testing), with answers from `docs/demos/shared/order-service.ts`. No server runs.

## What it does

- Suggests completions and walks snippets, shows signatures, hover cards and problems, and colors code by its meaning.
- Goes to definitions, peeks at references, walks call and type hierarchies, and keeps a history of places across files.
- Renames across files and applies code actions, through workspace edits the app's file operations carry out.
- Expands live templates, postfix templates and Emmet abbreviations, and closes and renames tags.
- Shows usages and authors above declarations, and draws documentation comments as formatted text.
- Draws diffs, proposed changes and agent attribution in the editor's font and colors.
- Shares one document per file between the editors of a project, so a server hears each change once.

## What it leaves to the app

The app starts, stops and routes the language servers and implements the `LanguageService` over them. It owns the files. Reading, drafts, saving, renaming and deleting go through the `ProjectFiles` it hands over, with its own permission checks. Git stays with the app too; code vision takes a blame the app ran. Where a file opens, which keys open which bar, and what a toast looks like are the app's to decide through the [`LanguageHost`](/editor-react/project#languagehost).

## Where to next

- [Getting started](/editor-react/getting-started) installs the package, loads styles and words, and mounts a first editor with a fake service.
- [Projects and documents](/editor-react/project) covers `ProjectLanguage`, the host, shared documents, language ids and the clipboard history.
- [Workspace edits](/editor-react/workspace-edits) covers how an edit across files reaches the app's files.
- [EditorView](/editor-react/editor-view) covers the component, `EditorLanguage` for an editor mounted by hand, the cards and how to draw your own.
- [Completion and signatures](/editor-react/completion) and [Snippets](/editor-react/snippets) cover suggestions, signature help and snippet sessions.
- [Hover, hints and colors](/editor-react/hover) and [Problems](/editor-react/problems) cover hover cards, inlay hints, semantic colors and diagnostics.
- [Navigation](/editor-react/navigation), [Call hierarchy](/editor-react/call-hierarchy) and [Rename and code actions](/editor-react/rename) cover moving through code and changing it.
- [Markup](/editor-react/markup), [Templates](/editor-react/templates) and [Links, colors and more](/editor-react/language-features) cover the smaller features, format on type included.
- [FindReplace](/editor-react/find-replace) covers the find and replace bar.
- [DiffView](/editor-react/diff-view), [Reviews and agents](/editor-react/change-review) and [Patch files](/editor-react/patch-files) cover diffs, proposals and editable patches.
- [Code vision](/editor-react/code-vision) and [Rendered documentation](/editor-react/rendered-documentation) cover usages, authors and formatted doc comments.
- [View state](/editor-react/view-state) covers where a file was scrolled, folded and left.
- [Accessibility](/editor-react/accessibility) covers what a screen reader hears.
- [Testing](/editor-react/testing) covers `FakeLanguageService` and `ManualTimers`.
- [Models](/editor-react/models) and [Reference](/editor-react/reference) list the pure functions and every export.

## Limits

- Features depend on the service. A feature only asks for methods the service supports; a command it lacks tells the person through `notify`.
- The editor's limits hold: no bidirectional text, and its [performance limits](/editor/#limits).
- [Accessibility](/editor-react/accessibility) is untested with a screen reader.
- Snippets follow the LSP syntax, with transforms in a worker. Without `snippetTransformWorker`, variables stay untransformed and field transforms do not run. Oversized or deeply nested snippets insert as plain text. See [snippets](/editor-react/snippets).
- Inlay hint actions need a pointer; only the tooltip has a keyboard path, through Quick Info. See [inlay hints](/editor-react/hover#inlay-hints).
- A server with neither semantic token deltas nor ranges gets a request for the whole document after each pause in typing.
- `applyWorkspaceEdit` refuses an edit that would overwrite without `supportsOverwrite` or lose unsaved work, and a failure halfway does not roll back. See [workspace edits](/editor-react/workspace-edits).
- Files over 20,000 lines get no code vision rows.

The package is FSL-1.1-MIT.
