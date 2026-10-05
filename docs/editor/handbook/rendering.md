# Rendering, viewport, and large files

The view renders visible rows plus an overscan margin. Its layout represents text lines, wrapped rows, folds, and block widgets. Rows outside the measured area use estimates until they enter view. Native scrolling moves one scroll container; gutter and sticky headers follow it.

Virtualized rendering bounds DOM work, but it does not make all editing operations constant time. Every edit rebuilds the row list, linear in line count. The core's search and some structure operations read full text synchronously. Measure the host's actual file sizes and decorations before choosing an automatic feature policy.

## Geometry and popups

`rectAt(position)` returns an `EditorRect` in page screen pixels or `null` when no layout is available for that position. `onViewChange` fires for scrolling and size changes. Recompute popup placement when it fires, including under a scaled ancestor. Do not convert those rectangles back to document offsets by arithmetic.

`getVisibleRange()` reports the text range in view, suitable for a bounded language request such as inlay hints. `getScrollTop()` returns pixels for a later mount's `scrollTop`. `getFolds()` collects collapsed/custom ranges. The host decides when and where to retain this state.

The editor follows size through `ResizeObserver` when the browser supplies it. Fonts affect measured widths, hit testing, wrapping, inlays, and caret geometry. Call `refreshFont()` after changing font family, size, line height, or ligatures, and after a delayed font loads. Theme color updates alone do not require a font refresh.

Wrapped lines break at spaces and within an overlong word. Continuation indentation is the line's indentation plus two characters. A click past a visual row's end draws the caret there; arrow navigation onto the shared offset draws it at the next row's start. Those are visual affinities for the same UTF-16 position.

## Current bounds

| Work                    | Current limit / behavior                                         |
| ----------------------- | ---------------------------------------------------------------- |
| Syntax coloring         | Lines over 20,000 characters stay uncolored                      |
| Automatic fold scanning | Disabled past 2 million document code units                      |
| Occurrence decoration   | Searches bounded single-line selections, omits excessive matches |
| Sticky scope headers    | At most five rows, also constrained by viewport height           |
| Model history           | Last 200 steps                                                   |
| Full-text regex search  | No timeout                                                       |

These bounds are protective fallbacks. They do not establish a maximum supported file size or latency target. A file with many short lines and one with a huge single line stress different paths. A tokenizer or host widget can add its own synchronous cost.

## Accessibility and bidirectional text

The input sink is a textarea with `aria-multiline` and a `Code editor` label. It holds a bounded context around the caret rather than copying a large file for every keystroke. Decorative code and overlay layers are hidden from accessibility APIs; status messages use a status role. Native textarea input supports composition and selection changes, but this is not a fully verified screen-reader editor.

There is no bidirectional text layout and no screen-reader verification beyond the textarea's context. Rendered documentation blocks are not implemented. Test IME input, keyboard-only navigation, zoom, high contrast, popup focus, and screen-reader behavior in each supported browser/desktop host. Do not advertise universal accessibility or assume a DOM fake proves it.

The root `EditorOptions` currently has no configurable accessible-label field. A host that needs labels for multiple file editors must reconcile that requirement with the package API instead of depending on an undocumented DOM query.
