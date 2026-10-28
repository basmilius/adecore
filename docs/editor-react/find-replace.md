# FindReplace

A find and replace bar over the [matcher of an editor](/editor/find-folding#find).

<Demo src="editor/find-replace" />

```tsx
<FindReplace editor={editor} onClose={() => setFindOpen(false)} />
```

| Prop        | Type         | Meaning                                         |
| ----------- | ------------ | ----------------------------------------------- |
| `editor`    | `Editor`     | The editor to search                            |
| `onClose`   | `() => void` | Escape in the bar; the bar does not hide itself |
| `className` | `string`     | On the bar                                      |

The bar has case, whole word and regular expression toggles, search in selection, a match count, previous and next, and a replace row with preserve case, replace and replace all. Enter goes to the next match, Shift+Enter to the previous. An invalid regular expression shows an error. Past the editor's mark limit the count ends with `+` (`1 / 10,000+`); replace all still covers every match. Unmounting the bar ends the find.

The app decides when the bar shows and which key opens it; the `findNext`, `findPrevious` and `replace` ids of the [key table](/editor/options#keymaps) name keys for that.
