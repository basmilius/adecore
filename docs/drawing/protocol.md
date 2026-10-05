# Drawing protocol

Import persisted schemas and types from `@adecore/drawing/protocol`. This entry point loads Zod without geometry or rendering dependencies. It defines document content; project identity, save requests and change events belong to the host's wire composition.

## Documents and validation

`DrawingContentSchema` contains `elements` in back-to-front stacking order. `DrawingDocumentSchema` adds required `version: 1` and a nonnegative integer `rev`. `DRAWING_VERSION` is `1`; `EMPTY_DRAWING` is `{ version: 1, rev: 0, elements: [] }`. Clone that shared value before editing it.

`migrateDrawing(value: unknown): DrawingDocument | null` currently parses this one version and returns `null` for invalid input. It does not migrate older shapes, increment revisions or check duplicate ids. `duplicateElementIdIn(elements: DrawingElement[]): string | null` returns the first repeated id and must run separately after parsing.

Objects strip unknown keys. Optional fields remain absent; the schemas do not insert render defaults. Missing required fields, invalid enums and unsupported versions fail parsing. The geometry fields are finite numbers, but the schemas do not require positive width/height, normalized bounds, pressure within `[0, 1]` or points contained in the stored box. Add those host constraints if needed.

## Element fields

Every element has a nonempty `id`, numeric `x`, `y`, `w`, `h`, a palette-name `stroke`, `strokeWidth` and a nonnegative integer `seed`. Id uniqueness is document local. Optional `locked` affects selection helpers, not write authorization.

| Optional field       | Render interpretation when absent           |
| -------------------- | ------------------------------------------- |
| `angle`              | `0` radians                                 |
| `strokeStyle`        | Solid                                       |
| `fill`               | No ordinary shape fill                      |
| `fillColor`          | Stroke color; notes use that name for paper |
| `roughness`          | `1`                                         |
| `font` on text/note  | `hand`                                      |
| `align` on text/note | Left                                        |
| `sized` on text      | Explicit line breaks without wrapping       |

| Kind                 | Additional fields                                                       |
| -------------------- | ----------------------------------------------------------------------- |
| `rect`               | Optional nonnegative `radius`                                           |
| `diamond`, `ellipse` | No extra required fields                                                |
| `line`               | At least two relative `[x, y]` points; optional `arrowStart`/`arrowEnd` |
| `freehand`           | At least one relative `[x, y, pressure?]` point                         |
| `text`               | `text`, integer `size` from 12 through 96; optional font, align, sized  |
| `note`               | `text`, integer size from 12 through 96; optional font and align        |

`DrawingElementSchema` is discriminated by `kind`. Palette fields accept names, not arbitrary color strings. The renderer uses host palettes to resolve those names.

## Schema and type reference

| Schema                     | Inferred type                          | Values or purpose                                                                      |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `DrawingFontSchema`        | `DrawingFont`                          | `hand`, `sans`, `mono`                                                                 |
| `DrawingColorSchema`       | `DrawingColor`                         | `ink`, `muted`, `accent`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink` |
| `DrawingFillSchema`        | `DrawingFill`                          | `none`, `solid`, `hachure`                                                             |
| `DrawingStrokeStyleSchema` | `DrawingStrokeStyle`                   | `solid`, `dashed`, `dotted`                                                            |
| `DrawingStrokeWidthSchema` | `DrawingStrokeWidth`                   | `1`, `2`, `4`                                                                          |
| `DrawingRoughnessSchema`   | `DrawingRoughness`                     | `0`, `1`, `2`                                                                          |
| `DrawingAlignSchema`       | `DrawingAlign`                         | `left`, `center`, `right`                                                              |
| `DrawingElementSchema`     | `DrawingElement`, `DrawingElementKind` | The seven element kinds                                                                |
| `DrawingContentSchema`     | `DrawingContent`                       | Element array                                                                          |
| `DrawingDocumentSchema`    | `DrawingDocument`                      | Versioned, revisioned content                                                          |

`DRAWING_COLORS` exposes palette names in their established menu order. `DRAWING_TEXT_SIZE_MIN` and `DRAWING_TEXT_SIZE_MAX` are 12 and 96. The constants, schemas, inferred types, `EMPTY_DRAWING`, `migrateDrawing` and `duplicateElementIdIn` are all protocol exports.

Keep enum order and optional-field omission when composing generated clients. A package rename does not require changing version `1` or a consumer's full wire protocol. See [Integration and migration](./migration).
