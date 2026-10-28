# Format on type

`language.formatOnType` lets the language server tidy code as a person types, through `textDocument/onTypeFormatting`: a `}` moved to its block's indentation, the line after Enter, a `;` that closes a statement.

It needs the service's optional `onTypeFormatting` ([`LanguageService`](/lsp/language-service)) and a server with `documentOnTypeFormattingProvider`; `supported` says so. The trigger characters are the server's `firstTriggerCharacter` and `moreTriggerCharacter`, listed by `triggerCharacters()`.

## When it asks

After a typed trigger character, it sends the character as `ch` and the editor's `tabSize` and `insertSpaces`. Only when all of these hold:

- The change is typed (`source` is `'input'`, or marked `typed` as Enter is). Undo, redo, host commands, reloads, completions, multi-character pastes and IME commits of several characters do not ask.
- The editor has one caret, is writable and has no [snippet](/editor-react/completion) session.

## What happens to the answer

The answer applies only if the text and caret are unchanged; a later edit cancels the request. Overlapping edits, empty answers and failures change nothing. The edits join the undo step of the typed character (`editor.applyEdits(edits, { mergeUndo: true })`), so one undo removes both.

## Enabling it

It is off by default. A host turns it on with `language.formatOnType.configure(true)` when the person chooses it. `configure(false)` turns it off and cancels a pending request. `isEnabled` reads the state.
