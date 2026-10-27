# Links, colors and more

The parts of the protocol that each add one thing to the editor. Every feature asks only when the service has its optional method and a server of the document answers it, and does nothing otherwise.

## Document links

`language.links` (`DocumentLinksFeature`) holds the links a server finds in the text (`textDocument/documentLink`), such as an import path or a web address in a comment. They are asked once the document is open, 500 ms after the last edit and when the providers change; an edit drops them until then. Mod+click on a link follows it before the click goes to a definition, and while Mod is held the link under the pointer is drawn as a link. A link without a target asks `documentLink/resolve` first.

A target in the editor (a file, or a document of a server's scheme) opens as a place of the host, on the line and column its fragment names: `#L12`, `#12` or `#L12,4`, counted from one. A web address goes to the host's `openExternal(url)`, or a new browser window without one. `all()`, `linkAt(position)`, `follow(link)` and `refresh()` serve a host that lists the links itself.

## Document colors

`language.colors` (`DocumentColorsFeature`) draws a swatch before each color a server finds (`textDocument/documentColor`), as an inlay hint of its own owner beside the server's hints. A press on a swatch lists the ways the server writes the color (`textDocument/colorPresentation`), so `rgb(255 0 0)` can become `#f00`, and a row that opens the platform's color picker. The new color is written the way the old one was when the server offers that form. `configure({ enabled: false })` takes the swatches away; `presentations(color)` and `apply(presentation, color)` serve a host with a picker of its own.

The swatch is the `swatch` field of an [`EditorInlayHint`](/editor/decorations), a CSS color drawn as a square of 12 pixels, its label what assistive technology reads. `setInlayHints(hints, owner?)` keeps the hints of every owner apart, so the colors and the server's hints stand side by side.

## Linked editing

`language.linkedEditing` (`LinkedEditingFeature`) asks the server which ranges are edited together once the caret rests for 100 ms (`textDocument/linkedEditingRange`), such as the names of a start and an end tag. A change inside one of them goes into the others, in the undo step of the key. The link ends with an edit outside the ranges, a text the server's `wordPattern` refuses, or a second caret. `configure({ enabled: false })` turns it off.

## Inline completions

`language.inlineCompletion` (`InlineCompletionFeature`) draws a server's suggestion ahead of the caret as ghost text (`textDocument/inlineCompletion`). It is off until `configure({ enabled: true })`, since a host may draw suggestions of its own there. Once on, it asks 300 ms after typing stops, or at once with the `suggestInline` key of the table. Tab takes the suggestion and runs its command, Alt+] and Alt+[ step through the others, Escape puts it away, and so does a caret that leaves it. A suggestion only shows where its text continues what the line holds up to the caret; an `InlineSuggestion` is the item with what it inserts and what the ghost shows. A suggestion list or a running snippet sees Tab first.

## Saving

`language.prepareSave(reason?)` lets the servers in before the host writes the file: it sends `textDocument/willSave` and applies the edits `textDocument/willSaveWaitUntil` answers, such as sorted imports. A server that has not answered within a second is passed over. Call it, write the file, then let the service send `didSave`. `reason` is `1` for a save a person asked for, `2` after a delay and `3` when focus left.

## Formatting a selection

`language.codeActions.formatSelection()` formats what is selected: every selection in one `textDocument/rangesFormatting` for a server that offers it, and one `textDocument/rangeFormatting` per selection otherwise; the whole document when nothing is selected. `formatsSelection` says whether a server formats ranges. The context menu lists it while something is selected.

## The project

`project.pullWorkspaceProblems(uri)` asks the server of `uri` for the problems of every file it knows (`workspace/diagnostic`) and lists them in [`project.problems`](/editor-react/project#problems). It keeps the result id of each document, so the next pull lets the server answer `unchanged`, and returns false when no server offers workspace diagnostics. When to pull, such as after a save, is the host's choice.

`project.readText(uri)` reads a document of a scheme a server owns, such as a decompiled class, through `textDocumentContent`, so a peek or a call hierarchy shows its code. A server's `window/showDocument` opens its place through `openPlace`, or a web address through `openExternal`, and its messages and logs reach `onServerMessage` of the host.
