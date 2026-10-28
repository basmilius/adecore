# @adecore/diagram

Directed graphs that are written rather than drawn. A diagram file lists nodes, groups and edges. The package places the nodes, routes the edges and writes SVG or lines of text. The same file always gives the same picture, so an agent can write a diagram without placing a box.

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

The dashed edge from `Approved?` back to `Commit` closes a cycle, which the layout ranks without but still draws. Under the diagram are the lines of `readingOrder`.

## What is in it

- [Documents](/diagram/documents): the schemas on `@adecore/diagram/protocol`, and `diagramProblemIn` for what a schema cannot check.
- [Layout](/diagram/layout): how `layoutOf` places nodes, wraps groups, routes edges and keeps dragged nodes.
- [Painting and reading](/diagram/rendering): `toSvg`, helpers for your own painter, and `readingOrder`.

The package takes its palette names, `Point`, `Rect` and default colors from [`@adecore/drawing`](/drawing/), so a diagram follows a theme like a drawing does. The protocol entry point loads Zod and the drawing protocol, without the layout or the renderer.

## What the app does

The package keeps no state. The app owns storage, the `rev` check on save, dragging (which writes a node's `pos`), selection, and the colors and font.
