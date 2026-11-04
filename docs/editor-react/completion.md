# Completion and signatures

<Demo src="editor/completion" />

## Suggestions

An identifier character, or one of the service's `triggerCharacters`, asks for suggestions after 80 ms. Later characters filter the open list, unless the service marked it incomplete. `completion.invoke()` asks at once, as Ctrl+Space does.

The popup shows the matched letters, a kind per row and the documentation of the active row, resolved through `completionItem/resolve` when the service supports it. A failed accept goes to the host's `notify`, so `accept()` never rejects. The keys while it is open:

| Key                | What it does                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Up, Down           | Moves through the list and wraps at the ends                                                        |
| Page Up, Page Down | Moves eight rows                                                                                    |
| Enter              | Inserts the active row                                                                              |
| Tab                | Replaces the word after the caret with the active row                                               |
| Escape             | Closes the list                                                                                     |
| A commit character | Inserts the row and types the character, once a person moved in the list or asked with the keyboard |

`completion.accept(replace, index?)`, `move(delta)` and `close()` do the same from code. Rows picked before rank higher. Accepting also applies the item's `additionalTextEdits`, such as an import, and runs its command. An item that is a snippet starts a [snippet session](/editor-react/snippets).

For a function, method or constructor in TypeScript, JavaScript, Vue, PHP or Python, accepting adds the parentheses and puts the caret between them, unless a call already opens after the caret. If the function takes parameters, the signature card opens too.

### Rows from the editor itself

`completion.addSource(source)` adds a `CompletionSource` and returns the function that removes it. Every request calls `source.items({ position, explicit, triggerCharacter })`, which must be synchronous and cheap. It returns `LocalCompletionItem` values: a `CompletionItem` whose edit range is the typed prefix on the caret's line, plus an `accept()` that inserts the row itself. The list never resolves these rows. A sort text of `'￿'` plus a key puts a row after matching service rows.

[Live templates](/editor-react/templates#suggestions) and [postfix templates](/editor-react/templates#postfix-completion) are such sources; `language.templates` adds them.

With a source added, the list also opens where no service answers or the service fails. A requested list with one row accepts it at once. `completion.showItems(items, start)` opens a list with only the given rows, the typed prefix starting at `start`. Typing narrows it, and a non-word character or a row that stops matching closes it.

## Signature help

A signature help trigger character, such as `(` or `,`, asks for the signatures of the call around the caret. `signature.invoke()` asks at once, as Mod+P does, and `close()` closes the card. `SignatureCard` takes a `SignatureViewModel` and shows the active signature with its active parameter in bold, its documentation and its place among overloads.

## Words from open text

`hippieCompletion` (`Alt+/`) and `hippieBackwardCompletion` (`Alt+Shift+/`) complete the word before each caret from words in the text, without a language server. The first press takes the nearest matching word above the caret, or below it for the backward command. A word matches when it is longer, starts with the same character and matches the rest case-insensitively or by camel humps (`fb` completes `fooBar`). Each press steps on, through the other open editors of the project and back, and is one undo step. In CSS, Markdown and plain text, `-` and `*` count as word characters.

`EditorLanguage` passes the texts of the project's other open editors through `setWordSources`. An app that mounts the editor itself passes its own to `Editor.setWordSources`, or `null`.
