# Markup

`language.markup` holds three helpers from IntelliJ: Emmet abbreviations, automatic end tags and paired tag renames. They work in `html`, `xhtml`, `xml`, `svg`, `xsl`, `vue` and `php` documents.

```ts
language.markup.supported; // whether the document is markup
language.markup.configure({ emmet: true, closeTags: true, linkedTags: true }); // each on unless false
```

## Emmet

Tab after an abbreviation expands it through the [`emmet`](https://github.com/emmetio/emmet) package. `div>p>lipsum` becomes a `div` with a paragraph of lorem ipsum, and `ul>li.item$*3` a list of three numbered items. The expansion uses the editor's indentation and lands as a snippet, so Tab walks the places to fill and Escape ends it.

Tab only expands in document text, with a single caret and no selection. Tags, attribute values, comments, `script`, `style`, PHP code and Vue `{{ }}` are excluded. A suggestion list, a running snippet, [live templates](/editor-react/templates#tab) and higher-[priority](/editor-react/editor-view#keys) handlers see Tab first. `language.markup.expand()` does the same for a menu and returns false when there was nothing to expand. `language.markup.abbreviationAt()` returns where the abbreviation Tab would expand starts, or `null`.

### Wrap with an abbreviation

`wrapWithAbbreviation` has no default chord, since `Mod+Alt+J` is Surround with Live Template, whose first row is Emmet (see [Surround With](/editor-react/templates#surround-with-and-unwrap)). `language.markup.startWrap()` opens a field over the selection, or over the caret's line. Enter wraps the text in the typed abbreviation. A repeat without a count, as in `ul>li*`, puts each line in its own element; otherwise the text goes in the innermost element. An invalid abbreviation keeps the field open with the reason. Escape or blur cancels. `LanguagePopups` draws the field; a host with its own reads `wrap` (`WrapView`) from `language.popups` and calls `submitWrap(abbreviation)` and `cancelWrap()`.

## Closing tags

The `>` that ends a start tag adds its end tag after the caret: `<div class="card">` leaves `<div class="card">|</div>`. Void elements (`br`, `img`, `input`, ...), self-closing tags and an end tag that already follows get none. `</` in text writes the end tag of the innermost open element. One undo removes the key and the tag.

## Linked tags

Renaming a start tag renames its end tag, and the other way around, in one undo step. A space or a change outside the name ends the link.

## Limits

A scanner reads the document, not a parser, so implied end tags (an `li` closing the one before) are unknown. Documents over 1,000,000 characters get no helpers. JSX and stylesheets are not covered.
