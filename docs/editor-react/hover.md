# Hover, hints and colors

<Demo src="editor/hover" />

## Hover cards

Resting the pointer on a name for 300 ms asks the service for its hover. The card closes 250 ms after the pointer leaves both name and card. `hover.quickInfo()` (Ctrl+J on a Mac, Ctrl+Q elsewhere) opens the card at the caret until the caret moves. `hover.keep()` pins the open card, `hover.hide()` closes it, and `hover.showRange(range)` opens an empty card over a range for the app to fill.

The card shows the signature as code, the documentation as Markdown with its tags set apart, a browser-support baseline when the server gives one, and the [problems](/editor-react/problems) at that place. Type names in the signature link to their definition. Where the service supports it, the card counts references after half a second; that can search the whole project, so `hover.configure({ referenceCount: false })` (a `HoverSettings`) turns it off. Markdown is GitHub-flavored without raw HTML. [`EditorRenderingProvider`](/editor-react/editor-view#editorrenderingprovider) colors the code, and [`hoverFooter`](/editor-react/editor-view#languagepopups) adds the footer.

## Semantic tokens, inlay hints and folds

These run without a field on `EditorLanguage`, after a pause in typing and when the service reports changed providers:

- Semantic tokens need a `legend` in the provider options. `decodeSemanticTokens` and `scopesOf` turn them into the scopes the editor colors through [`scopeColors`](/editor/theme#semantic-colors). Servers with `full: { delta: true }` get delta requests.
- In a large document, a server that offers `range` gets a request for the lines in view first, while the full request runs behind it. A range-only server only ever gets requests for the lines in view. `EditorLanguageOptions.semanticTokens`, a `SemanticTokensOptions`, sets what counts as large: `rangeLines` (5,000) and `rangeCharacters` (500,000).
- The feature requests [inlay hints](#inlay-hints) for the lines in view and some around them, 300 ms after an edit or scroll.
- Folding ranges and document symbols become [fold hints](/editor/folding#folding); symbols also feed sticky scroll and the breadcrumb.
- Selection ranges let Extend Selection grow through the server's ranges.

## Inlay hints

A label made of parts keeps them, so each part can be pointed at. `paddingLeft` and `paddingRight` add 4 pixels on that side. With the pointer:

- Resting 300 ms on a hint or part shows its `tooltip` in the hover card, the part's before the hint's. When needed, the feature first resolves the hint through `inlayHint/resolve`.
- Mod+click on a part with a `location` goes there and records the place for Back. Holding Mod underlines it.
- A click on a part with a `command` runs it through `workspace/executeCommand`; a failure goes to `notify`.
- A double click on a hint with `textEdits` applies them as one undo step, if the text has not changed since the hints came. If the hint also has a command, the single click waits half a second for a second press.
- A tap on a touch screen shows the tooltip and runs nothing.
- Quick Info on a hint's position shows its tooltip when nothing else is there.

A press on a hint that does nothing moves the caret as usual. Hints are not part of the text and are hidden from assistive technology. Apart from Quick Info for the tooltip, the pointer actions have no keyboard equivalent.
