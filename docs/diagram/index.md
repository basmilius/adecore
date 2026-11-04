# Diagram

`@adecore/diagram` draws directed graphs that are written rather than drawn. A diagram file lists nodes, groups and edges. The package places the nodes, routes the edges and writes SVG or lines of text. The same file always gives the same picture, so an agent can write a diagram without placing a box.

<Demo src="canvas/diagram-layout" />

The dashed edge from `Approved?` back to `Commit` closes a cycle, which the layout ranks without but still draws. Under the diagram are the lines of `readingOrder`.

## What it does

- Validates a diagram file with Zod schemas, and names the first broken reference in a sentence an agent can act on.
- Places nodes in columns along a direction, wraps groups around their members and routes edges in right angles.
- Keeps a node a person dragged where it was put.
- Writes a whole diagram as SVG, or hands out the shapes, text lines and edge paths for a painter of your own.
- Reads the graph back as lines of text, exactly as stored.

## What it leaves to the app

The package keeps no state. The app owns storage, the `rev` check on save, dragging (which writes a node's `pos`), selection, and the colors and font.

The package takes its palette names, `Point`, `Rect` and default colors from [`@adecore/drawing`](/drawing/), so a diagram follows a theme like a drawing does.

## Where to next

- [Getting started](/diagram/getting-started) writes a diagram, changes it and exports it.
- [Documents](/diagram/documents) describes the file and the rules a schema cannot check.
- [Layout](/diagram/layout) explains where nodes and groups go and how edges route.
- [Export to SVG](/diagram/rendering) covers `toSvg` and its options.
- [A painter of your own](/diagram/painter) covers drawing the layout as your own elements.
- [Reading order](/diagram/reading-order) turns a diagram into lines of text.
- [Reference](/diagram/reference) lists the limits and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/diagram/LICENSE).
