# @adecore/diagram

Directed graphs that are written rather than drawn. A diagram file says which nodes exist, which groups hold them and what points at what; the package computes where everything goes, routes the edges, and writes the result as SVG or as lines of text. The same file always gives the same picture, so an agent can write a diagram without placing a single box.

```sh
bun add @adecore/diagram
```

```ts
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';
import { diagramProblemIn, migrateDiagram } from '@adecore/diagram/protocol';

const diagram = migrateDiagram(JSON.parse(file));
const problem = diagram && diagramProblemIn(diagram);
if (diagram === null || problem) {
    throw new Error(problem ?? 'Not a diagram');
}

const layout = layoutOf(diagram);
const svg = toSvg(diagram, { layout });
const lines = readingOrder(diagram);
```

<Demo src="canvas/diagram-layout" />

The dashed edge from `Approved?` back to `Commit` closes a cycle. The layout ranks the nodes without it and still draws it. Under the diagram are the lines `readingOrder` writes for the same file.

## What is in it

- [Documents](/diagram/documents): the schemas of nodes, groups and edges on `@adecore/diagram/protocol`, and `diagramProblemIn`, which checks what a schema cannot.
- [Layout](/diagram/layout): how `layoutOf` ranks, orders and places nodes, wraps groups around them and routes edges, and what a node a person dragged does.
- [Painting and reading](/diagram/rendering): `toSvg`, the shape and text helpers for a painter of your own, and `readingOrder`.

The package depends on [`@adecore/drawing`](/drawing/) for its palette names, its `Point` and `Rect` and its default colors, so a diagram follows a theme the way a drawing does. The protocol entry point loads Zod and the drawing protocol, without the layout or the renderer.

## What the app does

The package keeps no state. The app owns storage and the `rev` check on save, dragging (which writes a node's `pos`), selection, and the colors and font it paints in.
