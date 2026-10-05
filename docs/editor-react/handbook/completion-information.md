# Completion, snippets, hover, and signatures

`EditorLanguage` coordinates the language features of one mounted file. Feature instances are accessible through the instance (`completion`, `snippets`, `hover`, `signature`, and others); they are not independent top-level factories. They use the project's service, keymap, popup store, and disposal list.

## Completion

`completion.invoke()` asks explicitly, and typing can trigger completion based on identifier context or provider trigger characters. The model accepts completion arrays, lists with defaults, or null, filters/ranks items by prefix, keeps recent choices, and handles documentation resolution separately from insertion.

`completion.accept(replace, index?, commit?)` chooses insertion versus replacement ranges, applies the selected text and additional edits, places carets, and runs supported item commands. `move(delta)` navigates rows; `close()` aborts pending work and clears the popup. The keyboard handles selection, insert/replace acceptance, pages, Escape, and commit characters. A single explicit result can insert immediately rather than showing a list.

Requests and resolves carry cancellation and current-text guards. Incomplete lists can refresh as the prefix changes. Do not invoke a second feature coordinator over the same editor or send a second completion request from a host key handler for a key the coordinator already handles.

`/models` exports `rankCompletions`, `matchDetail`, `matchScore`, `matchedCharacters`, `prefixFor`, `itemsOf`, `insertionOf`, `mirroredInsertions`, and documentation/kind helpers. These functions plan and display results; applying them still requires a current editor and service result. See [completion model tests](https://github.com/basmilius/adecore/blob/main/packages/editor-react/src/completion-model.test.ts) for item defaults and range cases.

## Snippet subset

`parseSnippet` returns plain insertion text and UTF-16 tab stops. `tabOrder` visits positive indices in numeric order and `$0` last, falling back to the end of text. The snippet session selects stops after insertion and handles Tab/Shift+Tab navigation.

```ts
import { parseSnippet, tabOrder } from '@adecore/editor-react/models';

const parsed = parseSnippet('print(${1:value}, ${2:count})$0');
console.assert(parsed.text === 'print(value, count)');
console.assert(
    tabOrder(parsed)
        .map((stop) => stop.index)
        .join(',') === '1,2,0'
);
```

Supported syntax includes numeric stops, placeholders with defaults, nested placeholder content, and a choice's first value. Bare variables insert nothing; defaulted variables insert their default; variable transforms are skipped. Duplicate stop indices are recorded but mirrors are not edited together. There is no complete TextMate/VS Code snippet-variable or transform engine. Enable LSP `snippetSupport` only when that subset is acceptable to the host/server.

Completion call planning can add parentheses and offer parameter hints for method/function/constructor items. `/models` exports `planCall`, `withParentheses`, and `PARAMETER_HINTS_COMMAND`. Do not promise arbitrary server command execution from a display helper; command routing belongs to the service.

## Hover and signatures

`hover.quickInfo()` asks at the caret. Pointer hover waits before opening and has a short hide delay so a person can enter the card. `holdCard` retains it while the pointer is inside; `keep` pins current information; `hide` ends it. Problems at a position can show without a hover provider.

Hover mapping splits signatures, markup, documentation tags, baseline data, and related definitions. The card can follow type links and count references through the service. Empty results are valid and leave no invented description. `EditorRenderingProvider` can supply a theme and async code highlighter for Markdown code blocks.

`signature.invoke()` explicitly asks for parameter information. Provider trigger/retrigger characters drive requests during typing. `SignatureCard` displays the current signature, active parameter span, parameter documentation, and signature count. `signature.close()` ends it. Parameter labels can be strings or offset pairs; `signatureViewOf` and `parameterSpan` normalize them.

`HoverCard`, `HoverSections`, `SignatureCard`, and `CompletionPopup` are coordinated through `LanguagePopups` (the root exports `HoverCard`, `SignatureCard`, and `CompletionPopup`; internal helpers are not promised as root components). Popup geometry follows editor `rectAt` / `onViewChange`. Information computed for an old document is discarded, and all request timers/listeners end on language disposal.

Rendering arbitrary returned Markdown/highlight HTML still needs the host's trust policy. An `EditorRendering.highlight` callback must return safe HTML from a trusted highlighter; it is not an authorization path for server-provided scripts or links.
