# Templates

A live template is a text a short key expands into, as in IntelliJ. Type `iter` in a JavaScript file, press Tab, and a `for...of` loop appears with the caret in its first field. `language.templates` is the `TemplatesFeature` of an editor; the templates live in the project's `TemplateRegistry`.

```ts
const templates = new TemplateRegistry();
templates.set({
    live: [{ id: 'own.todo', key: 'todo', body: '// TODO($1): $0', languages: ['javascript'], places: ['comment', 'code'] }]
});

const project = new ProjectLanguage(service, { templates });
```

## Live templates

A `LiveTemplate` has a stable `id` (built-ins use `builtin.<language>.<key>`), a `key` of 1 to 40 non-whitespace characters, a `body` in [snippet syntax](/editor-react/completion#snippets), an optional `description` and `group`, and the `languages` and `places` it applies to. `places` holds `'code'`, `'comment'` and `'string'`, and defaults to `['code']`. `group` sorts Insert Live Template and defaults to the first language. A leading tab in the body is one indentation unit of the editor. A body with `$TM_SELECTED_TEXT` wraps the selection.

`languages` are families: `javascript`, `typescript`, `php`, `css`, `html`, `xml` and `other`. TypeScript and TSX count as `javascript` and `typescript`, `vue` and `xhtml` as `html`, `svg` and `xsl` as `xml`, `scss` and `less` as `css`. Where the editor can tell, the place under the caret decides: the `<script lang="ts">` of a Vue file is TypeScript, its template HTML, and the markup of a PHP file HTML.

`BUILT_IN_LIVE_TEMPLATES` are IntelliJ's keys for JavaScript (`log`, `itar`, `ritar`, `iter`, `itin`), PHP (`fore`, `forek`, `pubf`, `prif`, `prof`, `pubsf`, `thr`), HTML and XML (`T`, which wraps the selection in a tag) and XML (`CD`). CSS has none. `BUILT_IN_POSTFIX_TEMPLATES` are listed under [postfix completion](#postfix-completion).

## The registry

`new TemplateRegistry({ builtins })` holds the built-in templates unless `builtins` is false. `set({ live, postfix, disabled, settings })` replaces what it names and keeps the rest; `disabled` lists built-in ids to turn off. `set` drops templates that fail `checkTemplate` and never throws. `live` and `postfix` list the enabled built-ins, then the host's. Two templates with one key become a choice on expansion. `onChange(listener)` runs after every `set` and returns its unsubscribe function.

`checkTemplate(template, kind?)` returns a reason in English for the host's form, or `null` when the template is valid. `kind` is `'live'` or `'postfix'`; without it, a template with an `expression` or `example` counts as postfix.

`TemplateSettings` has three switches, each on unless false: `liveInCompletion` (live templates in the suggestion list), `postfix` (Tab expands postfix templates) and `postfixInCompletion` (postfix templates in the suggestion list). `registry.settings` returns all three. To keep template rows out of documents no service serves, set `templates.set({ settings: { liveInCompletion: false } })`.

## Tab

Tab expands the key before the caret, as IntelliJ's `TemplateManager` does:

- The key is the longest text before the caret on its line that is a template key. A key starting with a letter, `_` or `$` must not follow an identifier character, so `xlog` is not `log`, while `x.iter` is `iter`. A postfix template takes `x.log` first.
- The template must apply where the key starts. If the longest key applies nowhere, no shorter key is tried.
- Several templates with one key open the suggestion list with only those rows.
- With several carets, every caret expands and the fields mirror. If one caret lacks the key, Tab does its usual work.
- A selection or a read-only editor leaves Tab alone.

A running snippet takes Tab first. An [Emmet](/editor-react/markup#emmet) abbreviation starting at or before the key wins; a live template key starting before the abbreviation wins over it. `language.templates.expand()` runs the same decision for a menu. It returns false when there is nothing to expand or the key is an Emmet abbreviation, which `language.markup.expand()` expands.

## Suggestions

With `liveInCompletion` on, the suggestion list gets a snippet row for each template that applies and whose key starts with the word before the caret. The row shows the description, with the body as documentation, and sorts after service rows of equal score. Accepting it expands the template.

## Insert Live Template

`language.templates.insert()` (`insertLiveTemplate`, `Mod+J`) lists the templates that apply at the caret, filtered by the word before the caret when it matches keys or descriptions. Rows sort by group and key. With a selection, the template replaces it and gets it as `$TM_SELECTED_TEXT`. Where no template applies, the editor tells the person through `host.notify`.

## Save as Live Template

`language.templates.saveSelection()` takes the selection, strips its shared indentation and escapes `\`, `$` and `}`. It passes a `LiveTemplateDraft` (`body`, `languages`, `places`) to `LanguageHost.saveAsLiveTemplate(draft)`, where the host opens its own form. It returns false without a selection or without the hook. The `saveAsLiveTemplate` key has no default chord.

## Postfix completion

A `PostfixTemplate` expands after a dot and its key, around the expression before the dot, which `$EXPR` in the `body` stands for. It has a `key` of identifier characters, `languages` (`javascript`, `typescript`, `php`), an optional `example` for its row (`if (expr) {}`), and an `expression` of `'any'` or `'statement'`.

`BUILT_IN_POSTFIX_TEMPLATES` are IntelliJ's, with ids `builtin.postfix.<language>.<key>`:

| Language                | Statements                                                                                          | Any expression                      |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| JavaScript, TypeScript  | `if`, `else`, `null`, `notnull`, `return`, `throw`, `const`, `let`, `forof`, `forin`, `log`          | `not`, `par`, `arg`, `await`, `typeof` |
| PHP                     | `if`, `isset`, `empty`, `null`, `notnull`, `return`, `throw`, `var`, `foreach`                       | `not`, `par`                        |

Type `x.if` and press Tab, and `x` becomes `if (x) {}` with the caret inside. The operands are the expressions ending right before the dot, as `Editor.postfixOperands` lists them: `a.b(c).d.if` takes the whole chain, and `1.if` offers nothing. A `statement` template takes the widest expression, only where it starts a statement. An `any` template with several candidates, such as `a` and `!a` for `!a.par`, opens an "Expressions" list, innermost first, with a preview of each. Nothing happens in a string or comment, with several carets, in a read-only editor, or with `settings.postfix` off.

With `postfixInCompletion` on, the suggestion list after a dot gets a row per applicable template, with its `example` and description.

## Surround With and Unwrap

`language.surround` is the `SurroundFeature`. Its commands are `open()` (`surroundWith`, `Mod+Alt+T`), `openTemplates()` (`surroundWithLiveTemplate`, `Mod+Alt+J`) and `unwrap()` (`unwrap`, `Mod+Shift+Delete`). Each takes its chord even where nothing applies, makes one undo step, and does nothing in a read-only editor. Some Linux desktops take `Ctrl+Alt+T`; reach the command from a menu through `language.surround.open()`.

### Surround With

`open()` surrounds the selection, or at a bare caret the trimmed content of its line. With several carets every range is surrounded and the fields mirror; overlapping ranges merge, and two ranges on one line refuse. All ranges must be in one language, as `placeAt` reports; otherwise `host.notify` gets "Couldn't find Surround With variants applicable to the current context".

`surroundShape` decides what applies: statement rows for whole statements, `(expr)` and `!(expr)` for one expression. The "Surround With" list numbers its rows `1` to `9`, `0`, then `A`, `B` and on; typing the character picks the row.

| Language                                  | Statements                                                                                            | Expressions        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ |
| JavaScript and TypeScript (also in Vue)   | `if`, `if / else`, `while`, `do / while`, `for`, `try / catch`, `try / finally`, `try / catch / finally`, `{ }`, `function` | `(expr)`, `!(expr)` |
| PHP                                       | `if`, `if / else`, `while`, `do / while`, `for`, `foreach`, `try / catch`, `try / finally`, `try / catch / finally`, `function` | `(expr)`, `!(expr)` |

Then come two region comments in any language with comments, "region...endregion Comments" and "&lt;editor-fold...&gt; Comments" (`//region Description`, `<!--region Description-->`). Last is the "Live templates" group: Emmet in markup, the `$TM_SELECTED_TEXT` templates that apply, and "Configure live templates…" when the host has `openTemplateSettings`.

A chosen row inserts its body with the selection as `$TM_SELECTED_TEXT`, and the caret goes to the first field, such as the condition. Emmet opens the wrap field of [markup](/editor-react/markup#emmet). The active row previews the result.

`openTemplates()` opens the "Live templates" group alone, titled "Select Template".

### Unwrap/Remove

`unwrap()` lists the constructs around the primary caret, innermost first, under "Choose the statement to unwrap/remove", with a preview. Typing narrows the list. A chosen row applies in one step.

In JavaScript, TypeScript and PHP the rows come from `Editor.unwrapTargets`: "Unwrap 'if...'" (drops the `else` chain), "Unwrap 'else...'", "Remove 'else...'", "Unwrap 'for...'" (also `foreach`), "Unwrap 'while...'", "Unwrap 'do...'", "Unwrap 'try...'" (drops `catch` and `finally`), "Remove 'catch...'", "Remove 'finally...'" and "Unwrap braces". Functions, classes, object literals and `switch` give none.

In HTML, XML, Vue and PHP markup, each enclosing element gives "Remove enclosing tag: div", which removes the two tags and outdents what was between them. Vue and PHP merge both lists, latest start first.

## Host hooks

`LanguageHost.templates` is the project's `TemplateRegistry`, read through `ProjectLanguage.templates`; see [`LanguageHost`](/editor-react/project#languagehost) for `saveAsLiveTemplate` and `openTemplateSettings`.

## Words

The words come from the `editor:language.templates.*` and `editor:language.surround.*` locale keys, in English and Dutch.
