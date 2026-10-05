# @adecore/drawing

[![npm](https://img.shields.io/npm/v/@adecore/drawing)](https://www.npmjs.com/package/@adecore/drawing)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/drawing/)

Hand-drawn shapes, arrows, freehand strokes, text and sticky notes as plain JSON, with hit tests and resizing for an editor, paths for a painter, an SVG export and a reading of a drawing as lines of text. It needs no DOM, so a backend exports a stored drawing the same way a page draws it.

**[Documentation with live demos](https://adecore.dev/drawing/)**

## Install

```sh
bun add @adecore/drawing
```

## Use

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

## Entry points

| Import | What it holds |
|---|---|
| `@adecore/drawing` | Geometry, paths, SVG export, text and reading order |
| `@adecore/drawing/protocol` | The Zod schemas and types of a drawing; loads nothing else |

## Documentation

| Page | What it covers |
|---|---|
| [Documents](https://adecore.dev/drawing/documents) | The document, the seven element kinds and reading a file |
| [Geometry](https://adecore.dev/drawing/geometry) | Bounds, hit tests, selection and resizing |
| [Paths and SVG](https://adecore.dev/drawing/rendering) | `toSvg` and the paths of one element for a painter of your own |
| [Text and reading order](https://adecore.dev/drawing/text) | Wrapping, measuring and `readingOrder` |

## License

FSL-1.1-MIT, see [LICENSE](./LICENSE). Rough.js and perfect-freehand keep their own licenses.
