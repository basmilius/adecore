# Reference

```ts
import { applyDrawingEdit, toSvg } from '@adecore/drawing';
import { migrateDrawing, type DrawingDocument } from '@adecore/drawing/protocol';
```

## Limits and constants

| Name                    | Value                              | Explained in                               |
| ----------------------- | ---------------------------------- | ------------------------------------------ |
| `DRAWING_VERSION`       | `1`                                | [Documents](/drawing/documents)            |
| `DRAWING_TEXT_SIZE_MIN` | `12`                               | [Documents](/drawing/documents)            |
| `DRAWING_TEXT_SIZE_MAX` | `96`                               | [Documents](/drawing/documents)            |
| `DRAWING_EDIT_LIMITS`   | `{ perEdit: 200, elements: 5000 }` | [Edits and rebasing](/drawing/edits)       |
| `DEFAULT_SVG_MARGIN`    | `32`                               | [Paths and SVG](/drawing/rendering)        |
| `LINE_HEIGHT`           | `1.25`                             | [Text](/drawing/text)                      |
| `NOTE_PADDING`          | `16`                               | [Text](/drawing/text)                      |

The element fields are on [Documents](/drawing/documents#elements) and the `SvgOptions` on [Paths and SVG](/drawing/rendering#tosvg).

## Exports

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

### `@adecore/drawing`

Edits, rebasing, geometry, paths, the SVG export, scenes, text and reading order.

<ExportTable entry="@adecore/drawing" />

### `@adecore/drawing/protocol`

The schemas and types of a drawing, and `migrateDrawing`. Loads Zod and nothing else.

<ExportTable entry="@adecore/drawing/protocol" />
