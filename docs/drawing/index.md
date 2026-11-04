# Drawing

`@adecore/drawing` stores hand-drawn shapes, arrows, freehand strokes, text and sticky notes as plain JSON. It has the code an editor needs around that JSON: hit tests and resizing, paths for a painter, an SVG export, edits by id and a reading of the drawing as lines of text. It needs no DOM, so a backend exports a stored drawing the same way a page draws it.

<Demo src="canvas/drawing-export" />

The demo passes one drawing to `toSvg` and `readingOrder`. Each shape stores a `seed`, so it wobbles the same way on every render.

## What it does

- Validates a drawing file with Zod schemas, on an entry point that loads nothing else.
- Applies an edit by id from a second writer, such as an agent, all or nothing.
- Rebases unsaved edits on a newer document and names the elements both sides changed.
- Finds the element under the pointer, the elements in a marquee and the new box of a resize.
- Gives the paths of one element for a canvas of your own, and writes a whole drawing as SVG.
- Wraps and measures text, and turns a drawing into lines an agent can read.

## What it leaves to the app

The package keeps no state and registers no listener. The app owns:

- Storage and conflicts. A document carries a `rev`; the app compares it with the stored one on save and writes `rev + 1`.
- Input: gestures, selection, undo, and the transform from screen pixels to world units.
- Theme and fonts. A drawing names palette colors and fonts, and the app says what they are when it paints or exports.

[`@adecore/diagram`](/diagram/) builds on this package for graphs that are written rather than drawn.

## Where to next

- [Getting started](/drawing/getting-started) creates a drawing, changes it and exports it.
- [Documents](/drawing/documents) describes the file and its seven element kinds.
- [Edits and rebasing](/drawing/edits) covers writers other than the editor on screen.
- [Geometry](/drawing/geometry) covers bounds, hit tests, marquee selection and resizing.
- [Paths and SVG](/drawing/rendering) covers painting one element and exporting a whole drawing.
- [Text](/drawing/text) covers wrapping and measuring text.
- [Reading order](/drawing/reading-order) turns a drawing into lines of text.
- [Reference](/drawing/reference) lists the limits and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/drawing/LICENSE).
