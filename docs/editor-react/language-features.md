# Links, colors and more

Each of these features adds one part of the protocol. It only asks when the service has the optional method and a server of the document answers it.

## Document links

`language.links` (`DocumentLinksFeature`) holds the links a server finds (`textDocument/documentLink`), such as import paths or web addresses in comments. They refresh 500 ms after the last edit. Mod+click follows a link before going to a definition, and holding Mod draws the link under the pointer. A link without a target is resolved first (`documentLink/resolve`).

A file target, or a document of a server's scheme, opens through the host's `openPlace` at the one-based line and column of its fragment: `#L12`, `#12` or `#L12,4`. A web address goes to `openExternal(url)`, or a new browser window without it. `all()`, `linkAt(position)`, `follow(link)` and `refresh()` serve a host that lists links itself.

## Document colors

`language.colors` (`DocumentColorsFeature`) draws a swatch before each color a server finds (`textDocument/documentColor`). Pressing it lists the server's notations of the color (`textDocument/colorPresentation`), so `rgb(255 0 0)` can become `#f00`, plus a row for the platform's color picker. A new color keeps the old notation when the server offers it. `configure({ enabled: false })` removes the swatches; `presentations(color)` and `apply(presentation, color)` serve a host with its own picker.

The swatch is the `swatch` field of an [`EditorInlayHint`](/editor/decorations): a CSS color drawn as a 12-pixel square, with its label for assistive technology. `setInlayHints(hints, owner?)` keeps each owner's hints apart, so swatches and server hints coexist.

## Linked editing

`language.linkedEditing` (`LinkedEditingFeature`) asks which ranges change together once the caret rests 100 ms (`textDocument/linkedEditingRange`), such as a start and end tag name. Typing in one updates the others in the same undo step. An edit outside the ranges, text the server's `wordPattern` refuses, or a second caret ends the link. `configure({ enabled: false })` turns it off.

## Inline completions

`language.inlineCompletion` (`InlineCompletionFeature`) draws a server's suggestion as ghost text after the caret (`textDocument/inlineCompletion`). It is off until `configure({ enabled: true })`, since a host may draw its own suggestions there. It asks 300 ms after typing stops, or at once with the `suggestInline` key. Tab accepts and runs its command, Alt+] and Alt+[ step through alternatives, and Escape or moving the caret away dismisses it. A suggestion list or running snippet takes Tab first. An `InlineSuggestion` holds what it inserts and what the ghost shows.

## Saving

`language.prepareSave(reason?)` sends `textDocument/willSave` and applies what `textDocument/willSaveWaitUntil` returns, such as sorted imports. A server that takes longer than a second is skipped. Call it, write the file, then let the service send `didSave`. `reason` is `1` for a manual save, `2` after a delay and `3` on focus loss.

## Formatting a selection

`language.codeActions.formatSelection()` formats every selection, through `textDocument/rangesFormatting` when offered and `textDocument/rangeFormatting` otherwise, or the whole document without a selection. `formatsSelection` says whether a server formats ranges. The context menu lists it while something is selected.

## The project

`project.pullWorkspaceProblems(uri)` asks the server of `uri` for the problems of every file it knows (`workspace/diagnostic`) and puts them in [`project.problems`](/editor-react/project#problems). It returns false when no server offers workspace diagnostics. The host decides when to pull, such as after a save.

`project.readText(uri)` reads a document of a server-owned scheme, such as a decompiled class, through `textDocumentContent`, so peek and the call hierarchy can show it. A server's `window/showDocument` goes to `openPlace` or `openExternal`, and its messages to `onServerMessage`.
