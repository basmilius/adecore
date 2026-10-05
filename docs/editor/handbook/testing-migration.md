# Testing and migration

Use the DOM helpers when behavior depends on input events or commands. `mountEditor` creates a page with fallback geometry, mounts a real engine, and exposes `type`, `press`, `release`, `clip`, and `click`. It uses a null tokenizer by default, so no grammar or provider is needed.

```ts
import { mountEditor } from '@adecore/editor/testing';

const mounted = mountEditor({ text: 'red blue red', theme: 'light' });
mounted.editor.setSelections([
    { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
    { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }
]);
mounted.type('green');
console.assert(mounted.editor.getText() === 'green blue green');
mounted.editor.runCommand('undo');
console.assert(mounted.editor.getText() === 'red blue red');
mounted.editor.dispose();
```

`createPage`, `press`, `release`, `typeInto`, `clipboard`, and `pointer` are the lower-level helpers. The page uses linkedom and has no real layout. Its fallback boxes and patched textarea selection provide deterministic interaction checks; they do not verify browser font metrics, IME integration, CSS, scaling, or accessibility.

`FakeEditorEngine` from `/fake` mounts a `FakeEditor` without a document model or real layout. It records decoration and host requests and exposes user-like `type`, `save`, `blur`, and caret operations. Its `type(text)` replaces the whole fake document, unlike `mounted.type(text)` which inserts through input. A fake tracks a changed stretch and can invalidate ranges earlier than the real editor. Use a real mount for history, search, and precise edit mapping.

The package's source tests run with `bun run --cwd packages/editor test`; `typecheck` and `build` are separate commands. Preserve the provenance and limitations of [`editor-core`](/editor-core/handbook/testing-provenance) when moving a host to these packages.

## Migrating a file editor

1. Mount a separate file editor in the host's existing sized region. Supply current text, path, grammar/theme ids, and explicit read-only state.
2. Replace application-owned editor CSS defaults with the package stylesheet. Keep intentional overrides after it and load the shared UI tokens.
3. Resolve a generic keymap plus the host's collision overrides once. Supply the same table to the engine, language coordinator, command handlers, and hints.
4. Connect dirty-state changes to `onChange`, language sync to `onTextChange`, and save policy to `onSave`. Preserve drafts and conflict baselines in the host.
5. Restore one-based opening line/column, scroll, and fold state. Convert incoming language positions to zero-based `character` values.
6. Add language features through an injected service and authorized host operations. Dispose features before the editor and project.

Keep filesystem authorization, process installation, remote transport, app navigation, menus, persistence, and agent orchestration in adapters. A package import change does not justify changing persisted paths or wire shapes. Validate the full host cutover before removing a previous implementation.

## Troubleshooting

An empty editor usually means an unsized or unpositioned host, missing stylesheet, or unavailable theme tokens. Wrong hit testing after a font setting change usually needs `refreshFont`. Plain syntax can mean an unknown language/theme or a failed grammar load; it can also be the deliberate long-line fallback.

Duplicate language updates usually mean the host subscribed in addition to a coordinator that already owns synchronization. A reload that marks a file dirty usually uses `onTextChange` instead of `onChange`. A stale popup usually retained a screen rectangle after scroll rather than following `onViewChange`.

Perform real-browser checks for typing, composition, undo/redo, multicaret, clipboard, wrap/folds, search, theme changes, widget disposal, and the [known accessibility and performance limits](./rendering). Test compiled/default imports from packed artifacts separately from linked `source` imports. Neither package tests nor successful extraction establishes a complete consumer migration.
