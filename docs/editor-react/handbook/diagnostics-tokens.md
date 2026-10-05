# Diagnostics, semantic tokens, inlay hints, and folding

The service supplies results in LSP coordinates. The coordinator maps them to editor decorations, retains useful prior results while refreshed data is pending, and aborts superseded requests. A custom service must enforce version freshness; the React view cannot recover it from a stale answer alone.

## Diagnostics and project problems

`DiagnosticsFeature` replaces a report from each source, combines the sources for its URI, maps diagnostic tags to unnecessary/deprecated rendering, and updates editor markers. Existing ranges follow local changes until the service sends a fresh report. `diagnostics.at(position)`, `step(direction)`, `goToFirst`, `counts`, and `onChange` support host problem controls.

```ts
import type { FakeLanguageService } from '@adecore/editor-react/testing';

export function reportExample(service: FakeLanguageService, uri: string) {
    service.report({
        uri,
        source: 'example-server',
        diagnostics: [
            {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
                message: 'Use a clearer name',
                severity: 2
            }
        ]
    });
}
```

`ProjectLanguage.problems` is a `ProjectProblems` store. `getSnapshot` retains the same array until a report; `subscribe` supplies an unsubscribe function. A `ProblemFile` has a display path and `ProblemRow[]`, each with diagnostic and server/source. Hints stay editor annotations and are omitted from the project list. Rows sort by severity then position; files sort by path. `countsOf` and `compareRows` expose the corresponding helpers.

`useProblemCounts(language)` reads file counts for error, warning, and info, returning zeros for `null`. A custom Problems panel can subscribe to the project's store and use `project.jumpTo` for destinations. The package does not provide the host's entire panel/navigation arrangement.

An explicitly versioned stale diagnostic must be filtered by the service. The React diagnostics model does not have the server's authoritative version clock. Keep source identities stable and send an empty source report when its diagnostics end.

## Semantic classification

The current React feature requests full semantic tokens after an edit pause or provider-change notification. It requires the full provider and its legend. `decodeSemanticTokens` turns the server's delta-encoded data into editor tokens; `scopesOf` maps token kinds/modifiers to theme scopes. The engine needs `scopeColors`, normally `shikiScopeColors`, to draw semantic overrides.

The LSP client exposes full/delta/range methods, but this feature currently uses full requests. Do not claim delta/range refresh support in the view just because the lower client can make those calls. Previously drawn colors follow edits while a refreshed result is pending; disposal clears them.

## Hints and structure

Inlay hints are requested for the visible range plus a 60-line margin after editing/scrolling or a provider change. Multipart labels flatten to text. The current mapping ignores the protocol's padding flags, commands, tooltips, and text-edit interactions. LSP hint resolve is available to a service caller but is not a promise that every UI interaction is present.

Document-symbol results update named editor blocks and feed folding/code vision. Folding combines server ranges and symbol body classification with lexical core folds. A null provider or lexical fallback can still give useful brackets/imports; it cannot produce a parsed symbol tree. `selectionRanges` lets Extend Selection use nested server ranges and fall back to core lexical expansion.

The current refresh policy waits after edits rather than making a request per keystroke. Timers and AbortControllers belong to the language instance. Call `service.onProvidersChanged` for an opened/ready document if the backend's startup completed after acquisition; the constructor does not force all background providers to refresh immediately just because the service returned from open.

For performance, leave optional reference-count/code-author rows disabled until the host configures them, and use the [large-file limits](/editor/handbook/rendering). A fully virtualized viewport still shares whole-document text and row-list work with the core/view.
