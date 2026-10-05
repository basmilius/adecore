# Review, proposals, and attribution

The package exports reusable display/model work for a host's proposed changes. It does not own the request to an agent, streaming turn state, provenance queries, approval policy, or durable inline-edit records. A host supplies the original text, proposal, author data, and acceptance/rejection callbacks.

## Guarding a proposal

`/models` exports `inlineRangeOf`, `lineSpanOf`, `problemsOnLines`, `parseAnswer`, `fitReplacement`, `endOfInsertion`, `locateSelection`, and text/range helpers. `parseAnswer` takes the last closed Markdown fence labeled `replacement` and returns its text plus the remaining explanation. An unfinished fence is not a usable replacement. It does not run a model or apply the result.

Use `editor.trackRange` while a host request is pending. If the original selection is edited, its guard becomes invalid. `locateSelection` can find a uniquely moved original text, returning null when absent or ambiguous. Neither method substitutes for an authorization check on acceptance.

```ts
import type { Editor, EditorRange } from '@adecore/editor';
import { fitReplacement, parseAnswer } from '@adecore/editor-react/models';

export function createProposal(editor: Editor, range: EditorRange) {
    const selected = editor.textInRange(range);
    const tracked = editor.trackRange(range);
    return {
        accept(answer: string): boolean {
            const parsed = parseAnswer(answer);
            const current = tracked.get();
            if (parsed.replacement === null || current === null || editor.textInRange(current) !== selected) {
                return false;
            }
            return editor.applyEdits([{ range: current, text: fitReplacement(selected, parsed.replacement) }]);
        },
        dispose: () => tracked.dispose()
    };
}
```

`fitReplacement` follows the selected text's LF/CRLF style and trailing-break shape. An accepted edit is one editor undo step. Dispose the guard when the host session ends, including rejection, cancellation, or file teardown.

## Review display

`ChangeReview` takes `editor`, `selected`, `proposal`, `label`, optional `startLine`, host `actions`, and `className`. It compares lines and uses `editor.renderCode` to draw unchanged/added/removed stretches with word emphasis. It does not accept a change itself. Give it an accessible label and keep its editor alive while it is mounted.

`startLine` is passed through to rendered code line numbers. Supply a one-based line number (normally `range.start.line + 1`) when numbering a proposal. The current component default is zero; omit numbering deliberately or pass an explicit valid first line for a numbered review.

`diffSegments`, `emphasisOf`, `replacedWords`, `replaceLines`, `replaceAllLines`, and `planConflict` are exported models for line diffs and conflict planning. They do not provide a durable review/session manager or filesystem write policy. Host code must retain its accepted/rejected state separately.

## Portal rows and highlight ownership

`RowHost(editor, owner)` supplies widget rows and observable containers for React portals. Use `subscribe`, `getVersion`, `container(id)`, `set(rows)`, and `clear`. Keep row component state outside a virtualized container, because the editor recreates it on reentry to view. `HostedRow` contains id, zero-based line, placement, and estimated height.

`LineActionHost` provides the same pattern for inline actions after line text; their containers live as long as their actions. `HostedAction` contains id and zero-based line. Clear each owner before its editor is disposed. `RowHost` currently compares id/line/placement rather than height when deciding whether to reapply rows; a height-only change is not a guaranteed update.

The DOM editor has one line-highlight set. `highlightLayers(editor)` returns a shared `HighlightLayers` aggregator; `set(owner, provider)` rereads all owners before replacing highlights, and `set(owner, null)` removes one. A provider must read current positions, so refreshing a conflict does not resurrect an old review range.

## Authors and usage rows

`language.codeVision.configure({ usages, authors })` enables optional declaration rows; both default off. Usage counts come from references for declarations around the viewport with at most three simultaneous requests. Declaration rows are omitted past 20,000 lines or when the declaration model exceeds 3,000 entries. Authors come from `setBlame` with a host-provided `GitBlameResult`, disk baseline text, and optional `openCommit` callback. A pending blame source can reserve row height while the host fetches it.

`GitBlameResult` includes commits and line-to-commit mapping, with optional `omitted: 'untracked' | 'too-large'`. `mapBlame`, `authorshipOf`, `authorsText`, and `UNCOMMITTED` map that input to display models. The package does not run Git. `CodeAuthorsCard` draws the coordinator's author popup; commit navigation is a supplied callback.

The DOM editor also accepts [`attribution marks, remote cursors, ghost text, and line highlights`](/editor/handbook/search-widgets#decoration-lifetimes). A displayed remote cursor is a decoration, not a collaboration protocol. A ghost suggestion is not inserted until the host validates and accepts it. Agent identity, code provenance, and who may apply changes remain explicit host data/policy.
