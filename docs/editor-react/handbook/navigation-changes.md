# Navigation, symbols, rename, and code actions

Navigation results stay in LSP coordinates until the coordinator chooses a destination. Location links use the target selection range for the caret and the wider target range for context. Duplicate places are removed before showing a choice.

## Going to a location

`language.navigation.go(kind, position?)` supports definition, declaration, type definition, and implementation. One result can navigate immediately; several results open a pick list. In-file navigation moves the editor caret; another URI calls `LanguageHost.openPlace`. An unsupported feature or no result reports through the optional host notification callback.

`language.goTo(location)` records history; `jump(position)` does the same within the file. `visit(place)` navigates without adding history, used by back/forward. `NavigationHistory` belongs to the project and can support recent locations. Host navigation must mount the target file and allow `takeCaret` to restore the requested character after opening its line.

The symbol picker uses document symbols, supports go-to-line input, and can search workspace symbols through the service. `symbolPicker.open`, `search(text, signal)`, `goTo`, `goToLine`, and `goToWorkspace` support host commands. Some workspace symbol results can omit a range; a host service should resolve them or the feature can only use available location data. The extracted picker does not add an automatic raw-session resolver.

## Peek

`peek.open()` asks for references and `peek.openDefinition()` asks for definitions. It groups results by file, reads snippets through `ProjectLanguage.readText`, and hosts an inline row with a React portal. Selection, expanding file groups, opening a destination, and closing keep the caret from moving accidentally.

Unreadable external files can still have a location even when a preview cannot be shown. The peek model bounds preview reads to 30 files (`PEEK_READ_FILES` in `/models`); it is not an unrestricted workspace scan. Navigation policy and authorization still belong to `openPlace` and the file adapter. `PeekPanel`, `PickPopup`, and `SymbolPicker` are normally rendered by `LanguagePopups`.

## Rename

`rename.start()` uses prepare-rename when advertised; otherwise it falls back to the local word range. A typing edit cancels the rename session. The input lights occurrences, `submit(name, preview)` requests the workspace edit, and `confirm()` applies the held preview result. `cancel()` ends it. A refusal leaves the input open with an error so a person can change the name.

`suggestNames` is optional and receives context plus sampled uses with an AbortSignal. The package does not choose or start a model. If it is absent, rename works without suggestions. Context sent by that callback is subject to the host's provider/privacy policy.

Current rename preview lists text changes and omits file moves. A pure resource rename can therefore have an empty text preview, and a mixed edit's preview does not describe its moves. Creates/deletes cannot produce a text preview and proceed to the workspace-edit adapter, which refuses them. A host that requires a separate confirmation before moving files must enforce it in the authorized file/rename adapter. Preview availability is not a transaction or permission guarantee.

## Code actions and formatting

`codeActions.open`, `refactorThis`, and `quickFixFor` query the relevant range/diagnostics. `organizeImports` requests source actions; `formatDocument` requests formatting using editor indentation. Action groups distinguish fixes, extract/inline/rewrite/move/refactor/source/other. Disabled actions keep their refusal reason.

Resolve support can fill an action's edit/command before preview or execution. `apply(entry)` applies workspace changes through the project and runs commands through the producing service. The host service must preserve result-server ownership for resolve/command calls. A command can itself request `workspace/applyEdit`; route that through the same authorized edit handler instead of a second write path.

Text edits in open files are undoable editor operations, and unopened text-only files become unsaved drafts. Creates/deletes, stale versions, runtime rollback, and rename persistence have the [workspace-edit limits](./host-integration#workspace-edits). No UI action bypasses host read/write authorization merely because a language server suggested it.

The exported `EditorContextMenu` draws the coordinator's menu state. It uses the resolved shortcut table and delegates editor commands or feature operations. Host global menu items, project actions, and placements remain host work. Keep shortcut hints and actual handlers on the same keymap.
