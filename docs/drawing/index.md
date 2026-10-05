# @adecore/drawing

Hand-drawn shapes, arrows, freehand strokes, text and sticky notes as plain JSON, and the code to work with them: hit tests and resizing for an editor, paths for a painter, an SVG export, and a reading of the drawing as lines of text. It needs no DOM, so a backend exports a stored drawing the same way a page draws it.

```sh
bun add @adecore/drawing
```

```ts
import { DEFAULT_PALETTE, readingOrder, toSvg } from '@adecore/drawing';
import { duplicateElementIdIn, migrateDrawing } from '@adecore/drawing/protocol';

const drawing = migrateDrawing(JSON.parse(file));
if (drawing === null || duplicateElementIdIn(drawing.elements) !== null) {
    throw new Error('Not a drawing');
}

const svg = toSvg(drawing.elements, { palette: DEFAULT_PALETTE });
const lines = readingOrder(drawing.elements);
```

<Demo src="canvas/drawing-export" />

The demo passes one drawing to `toSvg` and `readingOrder`. Switching the roughness redraws every shape, and each shape wobbles the same way on every render because it stores its own `seed`.

## What is in it

- [Documents](/drawing/documents): the schemas of a drawing and its seven element kinds, on `@adecore/drawing/protocol`.
- [Geometry](/drawing/geometry): bounds, hit tests, marquee selection and resizing in world coordinates.
- [Paths and SVG](/drawing/rendering): the paths of one element for a painter of your own, and `toSvg` for a whole drawing.
- [Text and reading order](/drawing/text): wrapping and measuring text, and `readingOrder`, which turns a drawing into lines an agent can read.

## Two entry points

| Entry point                 | Holds                                        | Loads                         |
| --------------------------- | -------------------------------------------- | ----------------------------- |
| `@adecore/drawing/protocol` | Zod schemas, types, `migrateDrawing`         | Zod                           |
| `@adecore/drawing`          | Geometry, paths, SVG, text and reading order | Rough.js and perfect-freehand |

A store that only validates files imports the protocol and never loads the renderer.

## What the app does

The package keeps no state and registers no listener. The app owns:

- Storage and conflicts. A document carries a `rev`; the app compares it with the stored one on save and writes `rev + 1`.
- Input: gestures, selection, undo, and the transform from screen pixels to world units.
- Theme and fonts. A drawing names palette colors and fonts, and the app says what they are when it paints or exports.

[`@adecore/diagram`](/diagram/) builds on this package for graphs that are written rather than drawn.
