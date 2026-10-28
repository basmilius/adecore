# @adecore/editor-react

Language features for [`@adecore/editor`](/editor/) over a [`LanguageService`](/lsp/language-service), with the React cards that show them: suggestions and snippets, hover, signature help, problems, go to definition, peek, rename, code actions, symbols, semantic colors, inlay hints, folds and code vision. The package starts no language server and touches no file. The app hands it a service and the file operations it allows.

```tsx
import { EditorView, ProjectLanguage } from '@adecore/editor-react';

const project = new ProjectLanguage(service, { folder: '/shop', keymap, openPlace });

<EditorView engine={engine} options={options} project={project} uri="file:///shop/src/order.ts" languageId="typescript" className="h-96" />;
```

<Demo src="editor/language-editor" fill />

The demos run over [`FakeLanguageService`](/editor-react/testing), with answers from `docs/demos/shared/order-service.ts`. No server runs.

## What is in it

- [Getting started](/editor-react/getting-started): install, styles, translations and a first editor with a fake service.
- [Projects and documents](/editor-react/project): `ProjectLanguage`, the operations the app hands it, shared documents, workspace edits and the problems of a project.
- [EditorView](/editor-react/editor-view): the component, `EditorLanguage` for an editor mounted by hand, `LanguagePopups` and `AnchoredPopup`.
- [Completion and signatures](/editor-react/completion), [Hover and problems](/editor-react/hover), [Navigation](/editor-react/navigation) and [Rename and code actions](/editor-react/rename): the features and their cards.
- [FindReplace](/editor-react/find-replace): a find and replace bar.
- [Call hierarchy](/editor-react/call-hierarchy), [Format on type](/editor-react/format-on-type), [Patch files](/editor-react/patch-files) and [Rendered documentation](/editor-react/rendered-documentation): callers and callees, typing-time formatting, editable `.patch` files and documentation comments drawn in place of their lines.
- [Reviews and agents](/editor-react/change-review): `DiffView`, `ChangeReview`, `AttributionCard` and React in editor rows.
- [Code vision](/editor-react/code-vision): usages and authors above declarations.
- [Models](/editor-react/models): the pure functions behind the features.
- [View state](/editor-react/view-state): where a file was scrolled, folded and left.
- [Testing](/editor-react/testing): `FakeLanguageService` and `ManualTimers`.

## Entry points

| Import                                             | What it holds                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `@adecore/editor-react`                            | The components, `ProjectLanguage`, `EditorLanguage`, the hosts and every model |
| `@adecore/editor-react/models`                     | Only the [models](/editor-react/models), without React                         |
| `@adecore/editor-react/testing`                    | `FakeLanguageService`, `ManualTimers` and the `LanguageCall` type              |
| `@adecore/editor-react/editor-react.css`           | The styles of the cards                                                        |
| `@adecore/editor-react/locales/en.json`, `nl.json` | The words of the `editor` namespace                                            |

## Accessibility

The features work through the editor's [accessibility methods](/editor/#accessibility) and the words of the `editor` namespace, in English and Dutch:

- The suggestion list and a snippet's choice list are listboxes. While one is open, the textarea points at it with `aria-controls` and at its active option with `aria-activedescendant`, so the option is read while focus stays in the text.
- Moving to a problem says its severity and message, such as `Error: Cannot find name`.
- A snippet says `Field 2 of 3` on each field, and `Field 1 of 3, 4 choices` when a field opens a choice list.
- `EditorView` names the fold controls from `language.fold`.
- [`DiffView`](/editor-react/change-review#accessibility) marks changed lines in text.

The symbol picker is a dialog with its own input. Nothing here has been tested with a screen reader.

## Limits

- Features depend on the service. A feature only asks for methods the service supports; a command it lacks tells the person through `notify`.
- The editor's limits hold: no bidirectional text, and its [performance limits](/editor/#limits).
- Accessibility is [untested with a screen reader](#accessibility).
- Snippets follow the LSP syntax, with transforms in a worker. Without `snippetTransformWorker`, variables stay untransformed and field transforms do not run. Oversized or deeply nested snippets insert as plain text. See [snippets](/editor-react/completion#snippets).
- Inlay hint actions need a pointer; only the tooltip has a keyboard path, through Quick Info. See [inlay hints](/editor-react/hover#inlay-hints).
- A server with neither semantic token deltas nor ranges is asked for the whole document after each pause in typing.
- A workspace edit is refused when it would overwrite without `supportsOverwrite` or lose unsaved work, and a failure halfway does not roll back. See [workspace edits](/editor-react/project#workspace-edits).
- Code vision rows are skipped in files over 20,000 lines.

The package is FSL-1.1-MIT.
