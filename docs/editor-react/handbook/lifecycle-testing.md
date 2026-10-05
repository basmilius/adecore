# Lifecycle, testing, theme, and migration

An editor view owns one mounted `EditorLanguage`; a project owns the shared `ProjectLanguage`. Dispose feature instances before their editor, unmount file views before disposing the project, and stop the injected service/process separately at its host lifetime. `EditorLanguage.dispose` and `ProjectLanguage.dispose` are idempotent. The view's `onMount` callback can return cleanup that runs before language/editor disposal.

`createHolder<T>()` is a small observable nullable holder for bridging an imperative instance into React. `LanguagePopups` reads the language's `PopupStore` and renders the active hover, completion, signature, pick, rename, peek, symbols, menu, and author states. `AnchoredPopup` uses page rectangles, and `EditorRenderingProvider` supplies theme/highlight behavior for code in cards. Most hosts should let `EditorView` compose these instead of rebuilding every popup.

## Fake-service checks

```ts
import { FakeEditorEngine } from '@adecore/editor/fake';
import { EditorLanguage, ProjectLanguage } from '@adecore/editor-react';
import { FakeLanguageService, ManualTimers } from '@adecore/editor-react/testing';

export async function checkLanguage() {
    const service = new FakeLanguageService();
    const project = new ProjectLanguage(service);
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: 'one', theme: 'light' });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, editor, 'file:///work/example.ts', 'typescript', timers);
    try {
        await language.document.ready;
        editor.type('two');
        console.assert(service.documents.get(language.uri)?.text === 'two');
        service.report({
            uri: language.uri,
            source: 'fake',
            diagnostics: [
                {
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
                    message: 'Example problem',
                    severity: 1
                }
            ]
        });
        console.assert(language.diagnostics.counts().error === 1);
    } finally {
        language.dispose();
        editor.dispose();
        project.dispose();
    }
}
```

The cast supplies the fake's unused element; it is not a browser element for a real engine. `FakeEditor.type` replaces its text, while the real [DOM testing helper](/editor/handbook/testing-migration) inserts through input. `ManualTimers.advance(ms)` drives scheduled feature work without waiting; await the resulting request promises/microtasks before asserting async results.

`FakeLanguageService.respond(method, handler, provider?)` supplies both an answer and advertised provider options. `calls` records requests and options, `documents` tracks versions/text, `report` emits diagnostics, and `refresh(uri)` emits provider changes. The fake rejects answers for changed text. It does not model all backend document reference counting or network/process failures; use [`FakeLanguageServer`](/lsp/handbook/testing-host) for those protocol checks.

Test delayed opens with edits/release, surviving-view sync ownership, snippet acceptance, stale results, diagnostics removal, preview/apply refusal, and timer/listener disposal. Run source tests with `bun run --cwd packages/editor-react test`. Verify compiled/default imports outside the workspace separately.

## View state

`viewStates` is an in-memory per-window map, not disk persistence. `ViewState` contains pixel scrollTop, one-based line/column, and folds. `openingPlace` gives an explicit reveal-line request priority, then remembered state, then placeholder scroll/default fold roles.

Use a host-scoped key such as a machine/project namespace plus path. `followViewStates(namespace, from, to)` moves file/folder state; `viewStateKey` redirects a closing old editor's last write; `forgetMovesFrom` clears that redirect when mounting a genuinely new file at the old key. Clear host-owned entries at project/window teardown if they should not survive in memory. These helpers do not migrate a host's stored drafts or durable settings.

## Find and replace

`FindReplace` takes an editor, optional className, and optional `onClose`. It validates regex syntax, drives editor find/replace/preview state, announces result counts, and ends find on unmount. Enter steps forward, Shift+Enter backward, Escape invokes host close and returns focus to the editor. It does not own whether the host shows the bar.

## Theme and locale setup

Load UI, editor, and editor-react CSS in order and include UI/editor-react sources in Tailwind scanning. Set chrome mode separately from the syntax theme. `EditorRenderingProvider.value.theme` should match the current syntax theme, and its optional `highlight(code, language, theme)` callback must produce trusted highlight HTML.

Register exported English/Dutch JSON under the `editor` namespace on the i18next singleton the package imports, and use that same instance in the React provider. Use the UI namespace for UI components. No package import initializes translations for the host.

Some transferred locale data includes labels for host-owned server/AI workflows; those labels are not evidence that the workflows ship here. Find/replace labels use the nested `find.replace` keys. English and Dutch input, button, and preserve-case labels are covered by component render checks; verify their layout and interaction in the host as well.

## Migration and remaining work

Keep file access, drafts, conflict/saved baselines, navigation placement, notifications, key collisions, language-server configuration/authorization, and AI requests in the host. Compose `ProjectLanguage` once per project/service scope and preserve the existing URI/wire/persistence identities when changing imports. Keep a file editor separate from prompt composition.

The extracted coordinator covers the language features described in these chapters. It does not complete streaming inline suggestion orchestration, agent turn/session ownership, persistent proposal records, server install/restart/log management views, file creation/deletion workspace edits, cross-file rollback, or comprehensive accessibility/bidi work. Review/proposal models and visual decorations provide building blocks for that host work.

Real-host checks must include keyboard and IME input, popup focus/placement under scrolling and scale, read-only actions, multi-view text consistency, source/default package loading, React deduplication, CSS utility scanning, locale keys, and the [view's performance/accessibility limits](/editor/handbook/rendering). Complete those checks before retiring an old implementation. Successful package tests alone do not establish a completed application cutover.
