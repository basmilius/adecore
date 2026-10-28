# EditorView

`EditorView` mounts an editor, attaches the language features of a project to it, and draws their cards. It is the component most apps need.

```tsx
<EditorView
    engine={engine}
    options={{ text, language: 'typescript', path: '/shop/src/order.ts', theme: 'github-light' }}
    project={project}
    uri="file:///shop/src/order.ts"
    languageId="typescript"
    onMount={(editor, language) => {
        const stop = editor.onSave(() => save(editor.getText()));
        return stop;
    }}
    className="h-96"
/>
```

| Prop               | Type                                         | Meaning                                                                                                                          |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `engine`           | `EditorEngine`                               | The engine that mounts the editor                                                                                                |
| `options`          | `EditorOptions`                              | The [mount options](/editor/options#mount-options)                                                                               |
| `project`          | `ProjectLanguage`                            | Optional; without it, or without `uri` or `languageId`, the editor has no features                                               |
| `uri`              | `string`                                     | The document's `file:` URI                                                                                                       |
| `languageId`       | `string`                                     | The LSP language id, such as `typescript` or `php`                                                                               |
| `timers`           | `Timers`                                     | The clock of the language features, such as `ManualTimers` in a test                                                             |
| `languageOptions`  | `EditorLanguageOptions`                      | What the app tunes about the features, as the last argument of `EditorLanguage`                                                  |
| `onMount`          | `(editor, language) => void \| (() => void)` | Called after mounting with the `Editor` and the `EditorLanguage`, or `null`; the function it returns runs before the editor goes |
| `contextMenuItems` | `(language) => ReactNode`                    | A group of the app in the [context menu](/editor-react/rename#context-menu)                                                      |
| `hoverFooter`      | `(view, language) => ReactNode`              | Sections of the app at the foot of the [hover card](#languagepopups)                                                             |
| `className`, `ref` |                                              | On the outer element, which needs a height                                                                                       |

Changing `engine`, `project`, `uri` or `languageId` remounts the editor with a fresh document and undo history. Everything else is read at mount, so inline `options` and `onMount` cost nothing per render. Later changes of `theme`, `readOnly`, `readOnlyReason`, `wrap`, `indentation`, `smartKeys`, `guides`, `stickyScroll`, `whitespace`, `rightMargin`, `foldOutline`, `label` and `messages` apply in place; other options only count at mount. On unmount it runs the `onMount` cleanup, then disposes the `EditorLanguage` and the editor. It never disposes the project.

## EditorLanguage

`new EditorLanguage(project, editor, uri, languageId, timers?, options?)` attaches every feature to an editor the app mounted itself. It acquires the document from the project and holds the features as fields: `completion`, `signature`, `snippets`, `hover`, `diagnostics`, `highlights`, `navigation`, `peek`, `callHierarchy`, `pick`, `symbolPicker`, `rename`, `codeActions`, `contextMenu`, `history`, `definitionLink`, `symbols`, `codeVision`, `formatOnType` and `renderedDocs`. Semantic tokens, inlay hints, folds and selection ranges run without a field.

```ts
const editor = engine.mount(element, options);
const language = new EditorLanguage(project, editor, uri, 'typescript');

await language.document.ready;

// Later, in this order:
language.dispose();
editor.dispose();
```

Attach one `EditorLanguage` per editor; `EditorView` already makes one. `language.goTo(location)` and `language.jump(position)` move the caret and record where it was; `visit(place)` moves it without a record. `language.onDispose(callback)` runs a callback when the language goes.

### Keys

The features see keys through `language.onKey(handler, priority?)`, which returns the function that removes the handler. Higher priorities go first, ties in order of adding, and the first handler to return `true` takes the key. `KEY_PRIORITY` holds each feature's priority, from highest to lowest: `pick`, `diagnostics`, `hover`, `completion`, `snippets`, `templates`, `markup`, `signature`, `highlights`, `codeActions`, `rename`, `navigation`, `peek`, `callHierarchy`, `symbolPicker`, `history` and `renderedDocs`. A handler without a priority comes after every feature.

To see a key before a feature, a subclass registers after `super()` with a higher priority:

```ts
class AssistedLanguage extends EditorLanguage {
    constructor(project: ProjectLanguage, editor: Editor, uri: string, languageId: string) {
        super(project, editor, uri, languageId);
        // Tab accepts the inline suggestion before the suggestion list and the snippet fields see it.
        this.onKey((event) => event.key === 'Tab' && acceptSuggestion(this), KEY_PRIORITY.pick + 1);
    }
}
```

An `editor.onKeyDown` handler runs before these when added before the `EditorLanguage`, and after them when added later.

## LanguagePopups

`<LanguagePopups language={language} />` draws every card a feature opens: hover, suggestions, signature help, the pick list, rename, peek, the call hierarchy, the symbol picker, the context menu and the authors card. `EditorView` renders it; an app that mounts by hand renders it next to the editor. Cards follow their character as the editor scrolls or resizes.

An app adds its own parts through `LanguagePopupsProps`:

| Prop               | Type                            | Meaning                                                                                                                                                                                                       |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`         | `EditorLanguage` or a subclass  | The editor's features; the callbacks below get the same type back                                                                                                                                             |
| `contextMenuItems` | `(language) => ReactNode`       | A group of the app in the [context menu](/editor-react/rename#context-menu)                                                                                                                                   |
| `hoverFooter`      | `(view, language) => ReactNode` | Sections at the foot of the hover card, such as actions on its problems. `view` is the card's `HoverView`; each top-level element gets a divider, and `null` adds nothing |
| `children`         | `ReactNode`                     | An app layer over the editor, drawn above the cards and below the rename field, such as an inline prompt                                                                    |

```tsx
<EditorRenderingProvider value={rendering}>
    <LanguagePopups
        language={language}
        hoverFooter={(view, language) =>
            view.problems.length === 0 ? null : (
                <div className="flex gap-1 px-3 py-2">
                    <Button size="xs" variant="secondary" onClick={() => explain(language, view.problems)}>
                        Explain
                    </Button>
                </div>
            )
        }
    >
        <InlinePrompt language={language} />
    </LanguagePopups>
</EditorRenderingProvider>
```

The cards render through portals, so a provider around `LanguagePopups`, such as `EditorRenderingProvider`, reaches all of them.

`createHolder<T>()` is the store `EditorView` uses to hand its `EditorLanguage` to React: `get`, `set` and `subscribe`, for `useSyncExternalStore`.

## AnchoredPopup

`AnchoredPopup` is the card every popup uses. It sits next to a `rect` from [`rectAt`](/editor/editing#selections) and stays inside the window. It renders into `document.body`, so it keeps the page's scale inside a scaled canvas.

<Demo src="editor/anchored-popup" />

| Prop                               | Meaning                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| `rect`                             | The box of the character, in page pixels                            |
| `placement`                        | `PlaceOptions`: `prefer` `'above'` or `'below'`, `gap` and `margin` |
| `className`, `children`            | The card's content                                                  |
| `overflow`                         | `'scroll'` by default, or `'clip'` for content that scrolls         |
| `onPointerEnter`, `onPointerLeave` | For a card that stays while the pointer is on it                    |

Render it again when the rect changes; it places itself on every render.

## EditorRenderingProvider

Code in hover cards and peeks is plain text unless an `EditorRenderingProvider` colors it. Its `value` is an `EditorRendering`: the syntax `theme` and an optional `highlight(code, language, theme)` that resolves to HTML, such as Shiki's `codeToHtml`. The HTML is inserted unescaped, so use a highlighter the app trusts.

```tsx
<EditorRenderingProvider value={{ theme: 'github-light', highlight: (code, lang, theme) => highlighter.codeToHtml(code, { lang, theme }) }}>
    <App />
</EditorRenderingProvider>
```
