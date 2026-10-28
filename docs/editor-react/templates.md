# Templates

Live templates are texts that a short key expands into. Type `iter` in a JavaScript file, press Tab, and a `for...of` loop appears with the caret in its first place. `language.templates` is the `TemplatesFeature` that does this for an editor, the way IntelliJ's live templates do. The templates themselves live in the `TemplateRegistry` of the project.

```ts
const templates = new TemplateRegistry();
templates.set({
    live: [{ id: 'own.todo', key: 'todo', body: '// TODO($1): $0', languages: ['javascript'], places: ['comment', 'code'] }]
});

const project = new ProjectLanguage(service, { templates });
```

## Live templates

A `LiveTemplate` has an `id` that stays the same (a built-in one is `builtin.<language>.<key>`), a `key` of one to 40 characters without whitespace, a `body` in [snippet syntax](/editor-react/completion#snippets), an optional `description`, and the `languages` and `places` it applies to. `places` is a list of `'code'`, `'comment'` and `'string'`, and `['code']` without it. `group` sorts the templates of Insert Live Template; the first language is the group without it. A leading tab in the body is one indentation unit, which the editor turns into its own (spaces or a tab). A body that uses `$TM_SELECTED_TEXT` is a selection template, which wraps the selected text.

`languages` are families: `javascript`, `typescript`, `php`, `css`, `html`, `xml` and `other`. A document counts for the families of its language id: TypeScript, TSX and their kin are `javascript` and `typescript`, `vue` and `xhtml` are `html`, `svg` and `xsl` are `xml`, `scss` and `less` are `css`, and every other language is `other`. Where an editor can tell, the family comes from the place under the caret and not from the document: the `<script lang="ts">` of a Vue file is TypeScript, its template is HTML, and the markup of a PHP file is HTML. An editor that cannot tell has the language of the document and `code`.

`BUILT_IN_LIVE_TEMPLATES` are the keys IntelliJ ships for JavaScript (`log`, `itar`, `ritar`, `iter`, `itin`), PHP (`fore`, `forek`, `pubf`, `prif`, `prof`, `pubsf`, `thr`), HTML and XML (`T`, which surrounds the selection with a tag) and XML (`CD`). CSS has none. `BUILT_IN_POSTFIX_TEMPLATES` is the list of [postfix templates](#postfix-templates) that ship with the editor.

## The registry

`new TemplateRegistry({ builtins })` holds the built-in templates unless `builtins` is false. `set({ live, postfix, disabled, settings })` replaces what it names and keeps the rest: the templates of the host, the ids of the built-in templates that are off, and the settings. `set` drops every template that fails `checkTemplate` and never throws. `live` and `postfix` list the built-in templates that are not disabled, then the host's. Two templates with one key are not an error; they become a choice when the key is expanded. `onChange(listener)` is called after every `set` and returns the function that stops it.

`checkTemplate(template, kind?)` returns a reason in English, or `null` when the template can be used: the key has the right length and characters (a postfix key holds identifier characters only), the body is not empty, parses and is at most 20,000 characters, and the languages and places are known. Pass `kind` (`'live'` or `'postfix'`) to say which rules apply; without it a template with an `expression` or an `example` counts as a postfix one. A host shows the reason beside its form.

`TemplateSettings` has three switches, each on unless false: `liveInCompletion` (live templates are rows of the suggestion list), `postfix` (Tab expands a postfix template) and `postfixInCompletion` (postfix templates are rows of the suggestion list). `registry.settings` reads them as a complete object.

## Tab

Tab expands the key before the caret, as IntelliJ's `TemplateManager` does:

- The key is the longest text before the caret, on its line, that is the key of a template. A key that starts with a letter, an underscore or a dollar sign must not follow another identifier character, so `xlog` is not `log` while `x.log` is.
- The template must apply to the place where the key starts. When the longest key found applies nowhere, no shorter key is tried.
- One template expands. Several with the same key open the suggestion list with only those rows.
- With several carets, the templates expand at every caret and the fields are mirrored. If one caret lacks the key, Tab does what it always does.
- A selection, a read-only editor and a document with no key before the caret leave Tab alone.

A running snippet takes Tab before the templates do, so the places of an expanded template are walked with Tab. Emmet comes after the templates in [markup](/editor-react/markup#emmet), but a key that starts at the same place as an Emmet abbreviation or later gives way to it, and a live template whose key starts before the abbreviation wins. `language.templates.expand()` runs the same decision for a menu. It returns false where there is nothing to expand, and where the key is an Emmet abbreviation, which `language.markup.expand()` expands.

## Suggestions

With `liveInCompletion` on, the suggestion list gets a row for each template that applies and whose key starts with the word before the caret. The row is a snippet (kind 15) with the description beside it and the body as its documentation, and it sorts after the rows of equal score that a language service gave. Accepting it expands the template. The rows also open the list in a document no language service answers for.

## Insert Live Template

`language.templates.insert()` (the `insertLiveTemplate` key, `Mod+J`) opens the suggestion list with the templates that apply at the caret. When the word before the caret fits the key of some templates, or their description, only those are listed; otherwise all of them are. The rows are sorted by group and key. With a selection, the chosen template replaces the selection and gets it as `$TM_SELECTED_TEXT`. Where no template applies, the editor tells the person through `host.notify` and announces it.

## Save as Live Template

`language.templates.saveSelection()` takes the selected text, removes the indentation it shares, escapes `\`, `$` and `}` so it reads back as itself, and hands the host a `LiveTemplateDraft`: the `body`, the first family of the place as `languages` and the place as `places`. The host opens its own form with it, through `LanguageHost.saveAsLiveTemplate(draft)`. It returns false, and announces that a selection is needed, without a selection, and returns false without that hook. The `saveAsLiveTemplate` key has no chord by default.

## Postfix templates

A `PostfixTemplate` is expanded after a dot and its key, around the expression before the dot: `$EXPR` in the `body` stands for it. It has a `key` of identifier characters, the `languages` it applies to (`javascript`, `typescript` and `php`), an optional `example` shown at the end of its row, as in `if (expr) {}`, and an `expression` that is `'any'` or `'statement'`. The registry holds them and `settings.postfix` and `settings.postfixInCompletion` switch them. No postfix template ships yet.

## Host hooks

`LanguageHost` gets three members. `templates` is the `TemplateRegistry` of the project, and `ProjectLanguage.templates` reads it; without one, the project has a registry of the built-in templates that lives as long as it does. `saveAsLiveTemplate(draft)` is called by Save as Live Template. `openTemplateSettings()` opens the host's settings for templates; it is the host's half of the "Configure live templates…" row, which a list shows only when the host has it.

A host that has no use for the rows in an unserved document sets `templates.set({ settings: { liveInCompletion: false } })`.

## Words

Every word comes from the `editor:language.templates.*` keys of the editor-react locales, in English and Dutch.
