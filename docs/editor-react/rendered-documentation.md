# Rendered documentation

`language.renderedDocs` draws documentation comments as formatted text in place of their lines, like IntelliJ's Reader mode. The comment stays in the document, so copy, find, undo and the language server see the raw text. A screen reader finds the block under "Rendered documentation" plus the first words of its summary.

It is off until a host turns it on, or a person switches one comment with its gutter button.

```ts
language.renderedDocs.configure({ renderDocComments: true }); // every documentation comment
language.renderedDocs.toggle(); // the comment the caret is in
language.renderedDocs.toggleAt(line); // the comment that starts on a line
```

## Which comments

A `/** ... */` comment on lines of its own, in TypeScript, JavaScript, Vue scripts, PHP and other languages with slash-star comments (Java, C#, Go, Rust, Kotlin, Swift, Dart). Not `/* */`, `//`, banners of three or more stars, comments sharing a line with code, or text in a PHP heredoc or nowdoc. Limitation: a quote inside a heredoc can hide the comments after it. `findDocComments(text, languageId)` of `@adecore/editor-core` and `@adecore/editor` returns them as `DocComment`s.

At most `MAX_DOC_COMMENTS` (500) comments per document are formatted; the rest stay text.

## What it shows

The description is Markdown. The tags follow, grouped by name, as a two-column list with the label in the muted color on the left and its values on the right.

| Tag                                        | Shown as                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `@deprecated`                              | A marked line above everything else                                            |
| `@param`, `@arg`, `@argument`, `@property` | Name and type in code, then the text. `[name=default]` and `...$args` are read |
| `@return`, `@returns`, `@yield`            | Type in code, then the text                                                    |
| `@throws`, `@exception`                    | Class in code, then the text                                                   |
| `@var`, `@type`, `@template`               | Name and type in code, then the text                                           |
| `@see`                                     | The target as a link, then the text                                            |
| `@example`                                 | The code, in the language of the document, without its `<caption>`             |
| `@since`, `@version`, `@author`            | The text                                                                       |
| Any other tag                              | `tag:` and the text                                                            |

JSDoc types go in braces (`{number}`). PHPDoc types without braces (`@param array<string, int> $filter`) are read in PHP only. `psalm-` and `phpstan-` prefixes read as the plain tag. A TSDoc dash between name and text is dropped.

Inline `{@link Name}`, `{@link Name label}`, `{@link Name|label}`, `{@linkcode}`, `{@linkplain}` and `{@see}` are links; `{@code text}` is code. A fixed set of HTML elements (`p`, `br`, `b`, `strong`, `i`, `em`, `code`, `tt`, `kbd`, `pre`, `a`, `ul`, `ol`, `li`, `h1` to `h6`, `blockquote`, `hr`) and the common entities become Markdown. Other elements, such as `script` or `img`, are dropped with their content. Only `http`, `https` and `mailto` link targets survive. The feature never sets HTML from a comment, and images show as their alt text.

## Switching

- **Gutter button.** A book button on the first line of each comment, pressed while it is formatted. It is a [gutter marker](/editor/decorations#gutter-buttons) of the owner `rendered-docs`.
- **Command.** `toggleRenderedDocs` (`Ctrl+Alt+Q` everywhere) and `language.renderedDocs.toggle()` switch the comment under the caret, and return false outside one. Carets inside a comment that turns formatted move to the line below it. A comment that is the whole document stays source. Outside macOS, AltGr+Q typing `@` is typing, not the shortcut.
- **Switch.** `configure({ renderDocComments, enabled })`. `enabled` is on unless `false`, so pass it on every call. Off, there are no buttons, the command does nothing and every comment is source. On again restores a person's switches.
- **Setting.** `renderDocComments` formats every comment; off by default, as in IntelliJ. Changing it resets a person's switches. `isRendered(comment)` and `all` read the state.
- **Editing.** A comment the caret or a selection touches shows as source, and formats again once the caret leaves. A click on the block never moves the caret. Up and Down step over a formatted comment and keep the column. A find match or go-to target inside one shows it as source first.

## Links

Cmd+click (Ctrl elsewhere) follows a name link through `workspace/symbol`. Without that, the name is code, not a link. A web link opens in a new window with the same key.

## Layout

The block uses the code face for names and types, the interface face for prose, and the theme's colors. It is at most 520 pixels wide and sits at the comment's indentation. Folding a rendered comment shows the fold placeholder. Only comments in view are parsed and drawn.

`LanguagePopups` draws the blocks. A host with its own popups reads `language.renderedDocs.getEntries()` with `useSyncExternalStore` and its `subscribe`, both called on the feature, and draws each `RenderedDocEntry` into its `container`. `entries()` builds a fresh list for code outside a render.

## Exports

`RenderedDocsFeature` is the class behind `language.renderedDocs`, with `RenderedDocsSettings` for `configure` and `RenderedDocEntry` for `getEntries` and `entries()`. The model is a `ParsedDocComment` of a description and `DocTagEntry`s, gathered into `DocTagSection`s.

## Replacing lines in the editor

The rows come from `setReplacements` of [`Editor`](/editor/rows#replacing-lines), which a host can use to draw any lines itself.
