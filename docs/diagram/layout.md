# Layout

`layoutOf(content)` places every node, group and edge in whole world units. It takes a document or its content. The same content gives the same layout on every machine.

```ts
import { layoutOf } from '@adecore/diagram';

const layout = layoutOf(diagram);
// layout.nodes:  { id, x, y, w, h, layer, pinned, label: string[], sub: string[] }[]
// layout.groups: { id, x, y, w, h, labelBox }[]
// layout.edges:  { index, from, to, points, label: { x, y, w, h, lines } | null }[]
// layout.bounds: { x, y, w, h }
```

`nodes`, `edges` and `groups` come in file order. A group that wraps no node has no box and is left out. `EdgeRoute.index` is the edge's position in the file, and `points` run from source to target, with the arrow head at the last. `bounds` covers everything drawn and is all zero for an empty diagram. The types are `DiagramLayout`, `NodeBox`, `GroupBox`, `EdgeRoute` and `EdgeLabelBox`.

## Layers

A diagram runs in columns along its direction. A node's `layer` is the longest path to it from a node nothing points at, counting from 0. A node without edges is in column 0.

To rank a cycle, the layout leaves out the edges that point back, walking in file order, and still draws them against the flow. Which edge drops out depends on file order, so moving a node in the file can change the layout.

## Order and placement

Inside a column, nodes are sorted to cross fewer edges, with ties kept in file order. Group members stay together, and groups keep their order across columns. Then nodes shift towards their neighbors, so a chain lines up straight. This is a heuristic: dense graphs can still cross edges, and spacing has no options.

A `down` diagram is a `right` one mirrored across the diagonal, with boxes and text kept upright.

## Sizes

A node's box follows from its wrapped text and its shape:

- The label is bold in `LABEL_SIZE` (14). `sub` is `SUB_SIZE` (12).
- Text wraps at 280 units minus padding. A box is at least 120 wide.
- A `diamond` is twice the size of its text and can be wider than 280. A `pill` and a `cylinder` add room for their ends and lid.

An edge label is `SUB_SIZE`, wrapped at 160.

Text widths are estimated from common system fonts, never measured, and lean wide. Text wraps at spaces, and a line break reads as a space. In a font the estimate does not fit, text can run past its box. A view that draws its own text sets it in `LABEL_SIZE` and `SUB_SIZE` and takes the lines from the layout.

## Groups

A group is a box 20 units around its members, with its label in a band of `GROUP_LABEL_BAND` (24) along the top, at `labelBox`. Groups do not nest. Edges between nodes outside a group do not cross it.

## Edges

Edges run in right angles between columns, each on its own track, and end on the outline of the shape. Edges that leave one side of a box spread along it. Labels sit beside their edge, and the space between columns widens to fit them. A self-edge is a small loop on the side of its box.

## Dragged nodes

A node with a `pos` stays there, rounded to whole units, with `pinned: true`. The app writes `pos` when a person drags a node, and removes it to hand the node back to the layout.

```ts
const layout = layoutOf({
    meta: { title: '', direction: 'down' },
    nodes: [
        { id: 'draft', label: 'Draft' },
        { id: 'review', label: 'Review', pos: [300.4, 200.6] }
    ],
    groups: [],
    edges: [{ from: 'draft', to: 'review', label: 'submit' }]
});
// review: { x: 300, y: 201, pinned: true, layer: 1, ... }
```

A pinned node keeps its `layer` but takes no room, so other nodes do not move out of its way. Its edges take a simple route with one step halfway, as do edges within one column. A group stretches to include a pinned member. The app prevents overlap.
