# Markup

Writing HTML goes faster with three helpers from IntelliJ: Emmet abbreviations, end tags that write themselves, and tag names that change in pairs. `language.markup` holds them. They work in documents of the language ids `html`, `xhtml`, `xml`, `svg`, `xsl`, `vue` and `php`, and do nothing in any other language.

```ts
language.markup.supported; // whether the document is markup
language.markup.configure({ emmet: true, closeTags: true, linkedTags: true }); // each on unless false
```

## Emmet

Tab after an abbreviation expands it, through the [`emmet`](https://github.com/emmetio/emmet) package. `div>p>lipsum` becomes a `div` holding a paragraph of lorem ipsum, and `ul>li.item$*3` a list of three numbered items. `lipsum` is another name for `lorem`, as in IntelliJ. The expansion is indented with the editor's indentation and lands as a snippet, so Tab goes on through the places to fill (the text of an element, an empty `href`) and Escape ends it.

Tab expands only in the text of the document: not in a tag or an attribute value, a comment, `script` or `style`, the code of PHP or a `{{ }}` interpolation of Vue. The caret must be a single caret with no selection. Where nothing before the caret reads as an abbreviation, Tab does what it always does. A suggestion list, a running snippet and every key handler with a higher [priority](/editor-react/editor-view#keys) see Tab first. `language.markup.expand()` does the same for a menu, and returns false when there was nothing to expand.

### Wrap with an abbreviation

`wrapWithAbbreviation` is a key of the key table without a default chord, since `Mod+Alt+J` is Surround with Live Template, as in IntelliJ, where Emmet is a row of that list. A host that wants the field on a chord of its own binds one, and `language.markup.startWrap()` opens it for a menu. It opens a field over the selection, or over the text of the caret's line without one. Enter wraps the text in the abbreviation typed there. An element repeated without a count, as in `ul>li*`, takes one line each; otherwise the text goes inside the innermost element. Lines keep their indentation relative to each other. An abbreviation that does not expand leaves the field open with the reason under it. Escape or leaving the field cancels. `LanguagePopups` draws the field; a host that draws its own reads `wrap` (`WrapView`) from `language.popups` and calls `submitWrap(abbreviation)` and `cancelWrap()`.

## Closing tags

The `>` that ends a start tag adds its end tag after the caret: typing `<div class="card">` leaves `<div class="card">|</div>`. There is no end tag for a void element of HTML (`br`, `img`, `input`, ...), a tag that closes itself with `/>`, a `>` in a quoted value, or when the same end tag already follows. `</` in text writes out the end tag of the innermost open element. Both join the undo step of the key, so one undo takes the key and the tag back.

## Linked tags

With the caret in the name of a start tag, a change of the name changes its end tag too, and the other way around, in the same undo step. The link holds while the caret stays in the name. A space, which starts the attributes, or any change outside the name ends it.

## Limits

The document is read by a scanner and not a parser. HTML's implied end tags, such as an `li` closing the one before it, are not known, so `</` and the linked tags go by the tags as written. A document over 1,000,000 characters is not read, and the three helpers do nothing in it. Abbreviations expand in markup only: JSX and stylesheets are not covered.
