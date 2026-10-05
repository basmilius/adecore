# @adecore/editor-react

Read the [React editor handbook](/editor-react/handbook/) for a working composition, host operations, language features, review displays, and lifecycle checks.

Language-enabled editors and React popups over an injected `LanguageService`. Completion and snippets, hover, signature help, diagnostics, selection ranges, semantic tokens, inlay hints, folding, navigation, rename, code actions, symbols, peek and code vision retain their current implementation. The package starts no process and imports no application checkout.

`ProjectLanguage` shares documents, navigation history and diagnostic counts across editors. `EditorLanguage` attaches the feature coordinators to one actual `Editor`. `EditorView` mounts an engine and renders `LanguagePopups`; use the coordinators directly when the host already owns mounting.

```tsx
import { createSmartEditorEngine } from '@adecore/editor';
import { resolveKeymap } from '@adecore/editor/keymap';
import { EditorView, ProjectLanguage } from '@adecore/editor-react';

const keymap = resolveKeymap({ goToDefinition: { mac: 'Alt+Shift+D', other: 'Alt+Shift+D' } });
const engine = createSmartEditorEngine({ tokenizer: async () => null, keymap, apple: false });
const project = new ProjectLanguage(service, { keymap, apple: false, openPlace });
const options = { text: 'const greeting = "Hello";', language: 'typescript', theme: 'github-light' };

// Render inside a parent with a height; dispose the project when its owner closes it.
<EditorView engine={engine} options={options} project={project} uri="file:///example.ts" languageId="typescript" className="h-72" />;
```

Here `service` is the host's `LanguageService` and `openPlace` is its file-opening callback. Keep the engine, options, project and `onMount` callback stable across renders: changes remount the editor. `EditorView` disposes its editor and attachment on unmount; it does not dispose the supplied project or service. Dispose `ProjectLanguage` after its editor attachments, then let the host shut down its service. Editors sharing a URI must already share text through the host; the first editor sends document changes, and a surviving editor takes over when it closes.

## CSS and translations

Import these styles in order:

```css
@import '@adecore/ui/theme.css';
@import '@adecore/editor/editor.css';
@import '@adecore/editor-react/editor-react.css';
@source "../node_modules/@adecore/ui/src";
@source "../node_modules/@adecore/editor-react/src";
```

The last two lines are Tailwind v4 source registrations, relative to the consumer stylesheet. React popups use Adecore UI components and Tailwind utilities. The editor DOM itself uses plain CSS and needs no Tailwind. The editor's positioned container must have a width and height. Define theme mode with `data-theme="light"` or `data-theme="dark"`, then override editor tokens after the imports if needed.

Register `@adecore/editor-react/locales/en.json` and `/locales/nl.json` under the `editor` i18next namespace before mounting popups. The host also initializes the `@adecore/ui` translations. `EditorRenderingProvider` optionally accepts a theme and asynchronous code highlighter for hover and peek previews. Plain code is rendered when none is provided. Markdown supports GFM without raw HTML.

The working example in `examples/language-editor.tsx` owns an isolated i18next instance, mounts the real DOM engine and supplies `FakeLanguageService` completion and hover responses. Type text or press Ctrl+Space to request completion. It uses no filesystem, provider CLI or language-server process.

## Host operations

`LanguageHost` accepts the folder, platform, resolved keymap, path resolver, file-opening callback, server display names, notifications and optional rename suggestions. `ProjectFiles` supplies reads, unsaved staging, saves and renames. Open-file text edits are undoable; unopened files become drafts. Edits containing renames save their changes through the host before moving files. Create/delete operations remain unsupported and return a failure. Permission checks and drafts belong in these adapters.

Git authorship is supplied explicitly to `language.codeVision.setBlame`; the library runs no Git command. Attribution marks and remote cursors remain engine primitives. `AttributionCard` accepts display content and host action elements. `ChangeReview` renders an explicit selected/proposed diff; its `startLine` is one-based. `RowHost`, `LineActionHost` and `HighlightLayers` coordinate independent display owners. Acceptance, persistence, AI prompts, chat routing, conflict policy and rollback remain host operations.

`FindReplace` operates on an explicit editor. `EditorContextMenu` accepts host action children. `/models` exports the pure language, proposal, edit and view-state helpers; `/testing` exports `FakeLanguageService` and `ManualTimers`. Default imports load compiled JavaScript and declarations; workspace consumers can enable `source` in the bundler, TypeScript `customConditions` and `bun test --conditions=source`.

## Current limits and validation

This is the current implementation, with remaining feature work preserved. Language results depend on the injected service's supported providers. No bidirectional text or completed screen-reader validation is claimed. The engine retains its long-line coloring and row-list performance limits. File create/delete edits, AI workflows, language-server lifecycle and product shortcuts remain outside this package.

Run `bun run build`, `bun run typecheck` and `bun run test` after workspace installation. Tests use editor fakes, memory services and manual timers. The package is private at version `0.0.0` and retains FSL-1.1-MIT. See the editor migration guide for source provenance and consumer cutover requirements.

See [Consumer migration](../editor/migration) for adapters and provenance.

## Language-enabled editor

<Demo src="editor/language-editor" fill />
