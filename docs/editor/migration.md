# Editor consumer migration

The transferred source snapshot is commit `9729144f0df3f25628f20cc283dee54f8d9e8162`, from 2026-10-05. The four editor packages retain the current behavior, tests and limits. They preserve FSL-1.1-MIT metadata; editor core also includes its Apache-2.0 word-predicate attribution and license. No source application file is removed by this extraction. Keep every original until the complete consumer cutover passes validation.

## Package boundaries

Replace the smart-editor-core, smart-editor and smart-editor-lsp imports with `@adecore/editor-core`, `@adecore/editor` and `@adecore/lsp`. Preserve `/fake`, `/shiki`, `/keymap` and `/testing` where used. The language coordinators and popups move to `@adecore/editor-react`. Enable the `source` condition for workspace development or use compiled exports for installed packages. No legacy Monaco implementation is transferred.

The host supplies the existing `LanguageService` adapter to `new ProjectLanguage(service, host)`. Keep wire requests and persisted shapes unchanged. Server catalogs, machine transport, installation/startup, authorization and native IPC remain in the consumer. The PHP server has its own package and lifecycle owner.

Map file reads, draft staging, saving and renaming to `ProjectFiles`; retain their permission checks and failure strings. Multi-file text changes preserve unsaved staging. Changes with renames save through the adapter before moving files. Create/delete edits still fail. The host continues to synchronize two editors of the same file; shared language ownership avoids duplicate document changes but does not synchronize their text.

## Existing consumer shortcut overrides

Resolve the collisions at the host boundary, using the following overrides to retain the current consumer's bindings:

```ts
import { resolveKeymap } from '@adecore/editor/keymap';

const keymap = resolveKeymap({
    expandSelection: { other: 'Alt+ArrowUp' },
    matchBrace: { other: 'Ctrl+M' },
    goToDefinition: { mac: 'Alt+Shift+D', other: 'Alt+Shift+D' },
    goToImplementation: { mac: 'Alt+Shift+I', other: 'Alt+Shift+I' },
    peekDefinition: { other: 'Alt+Shift+P' },
    historyBack: { other: 'Mod+[' },
    historyForward: { other: 'Mod+]' },
    nextProblem: { mac: 'Alt+F2', other: 'Alt+F2' },
    selectionToChat: { mac: 'Mod+Alt+K', other: 'Mod+Alt+K' },
    inlineEdit: { mac: 'Mod+I', other: 'Mod+I' },
    suggestInline: { mac: 'Alt+\\', other: 'Alt+\\' },
    acceptGhostWord: { mac: 'Alt+]', other: 'Alt+]' }
});
```

Pass this same object to `createSmartEditorEngine({ keymap, apple, ... })`, `new ProjectLanguage(service, { keymap, apple, ... })` and `chordOf(command, apple, keymap)` for host menu hints. `taken.mac` and `taken.other` can carry the host's collision descriptions. Retain the host's `handBack` list so its global bindings still reach the surrounding application. The last four commands are host AI operations; their library defaults are unbound, and enabling their keys does not supply an AI implementation.

## Routing, rendering and host workflows

`openPlace` receives the URI and zero-based UTF-16 position. The consumer owns file focus, panels and view routing. `ProjectLanguage` preserves pending columns through `takeCaret` and shares navigation history. Notifications go through `host.notify`; server names are explicit display values. Rename suggestions use an optional `suggestNames(request, signal)` callback without choosing a provider or process.

Import Adecore theme CSS, editor CSS and editor-react CSS. Add `packages/editor-react/src` to the consumer's Tailwind scan and initialize its `editor` namespace from the en/nl assets. Supply an `EditorRenderingProvider` for highlighted hover/peek previews, or allow plain code. Existing font, find, theme, changed-line and attribution colors can override the package defaults.

The host keeps AI explanation, ghost generation, chat selection, inline prompts, review acceptance/undo, agent-change persistence, conflict resolution and provenance lookup. Reuse explicit-input `ChangeReview`, `AttributionCard`, `RowHost`, `LineActionHost` and `HighlightLayers`, together with editor widgets, remote cursors, attribution marks and ghost text. Supply Git blame to code vision rather than importing a product Git bridge. View-state helpers retain one-based caret/scroll/fold shapes and namespace/path keys; namespace selection and persistence remain host-owned.

## Cutover validation

Run combined workspace installation, lint, typecheck, test, build, docs build and packed-export validation after integrating these packages. Verify typing/IME, selections/undo, folding and view state, find/replace, same-file document ownership, completion/snippets, navigation history, rename/workspace edits, provider refresh and stale responses, theme modes and popup placement. Run the consumer's server/transport and PHP integration checks separately. Preserve all remaining editor and PHP work and the documented accessibility, bidi, language and performance limits. Only a completely switched and validated consumer authorizes deleting originals.
