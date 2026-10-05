# Documents

A drawing is a list of elements in stacking order, back to front. The schemas and types are on `@adecore/drawing/protocol`, which loads Zod and nothing else.

```json
{
    "version": 1,
    "rev": 4,
    "elements": [
        { "kind": "rect", "id": "box", "x": 0, "y": 0, "w": 160, "h": 80, "stroke": "blue", "strokeWidth": 2, "seed": 7, "fill": "hachure" },
        { "kind": "line", "id": "arrow", "x": 160, "y": 40, "w": 120, "h": 0, "stroke": "ink", "strokeWidth": 2, "seed": 8, "points": [[0, 0], [120, 0]], "arrowEnd": true }
    ]
}
```

`DrawingDocumentSchema` is that object: `version` is `DRAWING_VERSION` (1), `rev` a whole number of at least 0. `DrawingContentSchema` is only `elements`, for a wire message that carries the version and revision elsewhere. `EMPTY_DRAWING` is the empty document at `rev` 0; copy it before you change it.

## Reading a file

```ts
import { duplicateElementIdIn, migrateDrawing } from '@adecore/drawing/protocol';

const drawing = migrateDrawing(JSON.parse(file));
const duplicate = drawing && duplicateElementIdIn(drawing.elements);
```

`migrateDrawing` returns the parsed document, or `null` for anything that is not one. There is one version so far, so it only parses. `duplicateElementIdIn` returns the first id used twice, or `null`. The schema cannot see duplicates, and two elements with one id would both be hit and selected at once, so run it after every parse.

Parsing drops keys the schema does not know and leaves optional fields out. Nothing fills in defaults; the renderer reads an absent field as its default.

## Elements

Every element has these fields:

| Field         | Type                                               | When absent        |
| ------------- | -------------------------------------------------- | ------------------ |
| `id`          | A string of at least one character                 | Required           |
| `x`, `y`      | The top left corner, in world units                | Required           |
| `w`, `h`      | The size of the box                                | Required           |
| `stroke`      | A palette name                                     | Required           |
| `strokeWidth` | `1`, `2` or `4`                                    | Required           |
| `seed`        | A whole number of at least 0 that fixes the wobble | Required           |
| `angle`       | Radians around the center of the box               | `0`                |
| `strokeStyle` | `solid`, `dashed` or `dotted`                      | `solid`            |
| `fill`        | `none`, `solid` or `hachure`                       | `none`             |
| `fillColor`   | A palette name                                     | The `stroke` color |
| `roughness`   | `0` (architect), `1` (artist) or `2` (cartoonist)  | `1`                |
| `locked`      | Skipped by `elementAt` and `elementsIn`            | `false`            |

`kind` picks the rest:

| Kind                 | Extra fields                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `rect`               | `radius`, at least 0, for rounded corners                                                                                                 |
| `diamond`, `ellipse` | None                                                                                                                                      |
| `line`               | `points`, at least two `[x, y]` relative to `(x, y)`; `arrowStart` and `arrowEnd` draw a head                                             |
| `freehand`           | `points`, at least one `[x, y, pressure?]` relative to `(x, y)`                                                                           |
| `text`               | `text`, `size` (a whole number from 12 to 96), `font`, `align`, and `sized`, set once the box was resized by hand so the text wraps to it |
| `note`               | `text`, `size`, `font` and `align`: a sheet of paper in `fillColor` with the text on it                                                   |

A note is one element, not a shape with a text on top, so moving it moves what it says. `font` is `hand`, `sans` or `mono` and reads as `hand` when absent; `align` is `left`, `center` or `right` and reads as `left`.

The schema does not check that `w` and `h` are positive or that the points of a line fit its box. Keep both in step when you edit an element; geometry and export read the box, not the points.

## Schemas and constants

| Schema                     | Type                                   | Values                                                                                 |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `DrawingColorSchema`       | `DrawingColor`                         | `ink`, `muted`, `accent`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink` |
| `DrawingFontSchema`        | `DrawingFont`                          | `hand`, `sans`, `mono`                                                                 |
| `DrawingFillSchema`        | `DrawingFill`                          | `none`, `solid`, `hachure`                                                             |
| `DrawingStrokeStyleSchema` | `DrawingStrokeStyle`                   | `solid`, `dashed`, `dotted`                                                            |
| `DrawingStrokeWidthSchema` | `DrawingStrokeWidth`                   | `1`, `2`, `4`                                                                          |
| `DrawingRoughnessSchema`   | `DrawingRoughness`                     | `0`, `1`, `2`                                                                          |
| `DrawingAlignSchema`       | `DrawingAlign`                         | `left`, `center`, `right`                                                              |
| `DrawingElementSchema`     | `DrawingElement`, `DrawingElementKind` | One element, by `kind`                                                                 |
| `DrawingContentSchema`     | `DrawingContent`                       | `{ elements }`                                                                         |
| `DrawingDocumentSchema`    | `DrawingDocument`                      | `{ version, rev, elements }`                                                           |

`DRAWING_COLORS` lists the palette names in the order a color menu shows them. `DRAWING_TEXT_SIZE_MIN` and `DRAWING_TEXT_SIZE_MAX` are 12 and 96.
