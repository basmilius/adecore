# Completion and signatures

<Demo src="editor/completion" />

## Suggestions

Typing an identifier character, or a trigger character the service lists in the `triggerCharacters` of its completion options, asks for suggestions after a pause of 80 milliseconds. Each later character filters the list that is there, unless the service marked it incomplete; then the list is asked again. `completion.invoke()` asks at once, as Ctrl+Space does.

`CompletionPopup` draws the list: the matched letters, a letter and color per kind, and the documentation of the active row beside it, resolved through `completionItem/resolve` when the service supports it. The keys while it is open:

| Key                    | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| Up, Down               | Moves through the list, round at the ends                  |
| Page Up, Page Down     | Moves eight rows                                           |
| Enter                  | Inserts the active row                                     |
| Tab                    | Replaces the word after the caret with the active row     |
| Escape                 | Closes the list                                            |
| A commit character     | Inserts the row and types the character, once a person moved in the list or asked with the keyboard |

`completion.accept(replace, index?)`, `move(delta)` and `close()` do the same from code. A row the person picked before ranks higher next time. Accepting applies the item's `additionalTextEdits` too, such as an import, and runs its command when it has one.

For a function, method or constructor in TypeScript, JavaScript, Vue, PHP or Python, accepting adds the parentheses and puts the caret between them, unless the code after the caret already opens a call. That also opens the signature card when the function takes parameters.

## Snippets

An item with `insertTextFormat: 2` is a snippet. After it lands, Tab and Shift+Tab walk its stops, `$0` last, and the session ends at the last stop or when the caret leaves. The subset this supports: numbered stops, placeholders with a default, nested placeholders and the first value of a choice. A variable inserts its default or nothing, a transform is skipped, and two stops with the same number are not edited together.

```ts
import { parseSnippet, tabOrder } from '@adecore/editor-react/models';

const snippet = parseSnippet('print(${1:value}, ${2:count})$0');
snippet.text; // 'print(value, count)'
tabOrder(snippet).map((stop) => stop.index); // [1, 2, 0]
```

## Signature help

Typing a trigger character of the service's signature help, such as `(` or `,`, asks for the signatures of the call around the caret. `signature.invoke()` asks at once, as Mod+P does, and `close()` closes the card. `SignatureCard` draws the active signature with the active parameter in bold, its documentation, and which of several signatures it is. Its prop is a `SignatureViewModel`, made by `signatureViewOf` from the service's answer.
