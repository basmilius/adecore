# Layers, groups and layout

## Layers and cycles

`layersOf(nodes, edges)` returns a map from node id to zero-based layer. For an acyclic graph, a layer is the longest path from a source. Unconnected nodes start at layer zero.

Cycles are accepted. A depth-first walk visits sources first, then unvisited nodes in file order. Edges pointing back to a node still on that walk are omitted from ranking. A topological pass computes longest paths over what remains. Self-loops do not affect layers. This is iterative, so ranking a long chain does not consume the call stack.

Only ranking omits those edges. The renderer still routes cycles, loops and parallel edges. File order determines how a cycle breaks; rearranging nodes or edges can therefore change layout even if the graph's connections are otherwise equivalent.

`layersOf` ignores unknown endpoints as a defensive behavior. That is not validation. Run `diagramProblemIn` before any layout so an invalid reference receives a named error instead of disappearing from output.

## Direction and ordering

`layoutOf` accepts `meta`, `nodes`, `groups` and `edges`; it does not need `version` or `rev`. Direction is `right` or `down`. It lays out a right-flow frame and mirrors coordinates for downward flow while keeping label text upright and node shapes at their measured size.

The output `nodes`, `groups` and `edges` remain in file order, except that empty groups have no box. Visual ordering across a layer can change to reduce edge crossings. Ties keep the previous order, initially file order. Group members stay together as a block, and group blocks keep one relative order across layers.

The layout uses a fixed number of ordering sweeps and median placement rounds. It is deterministic for the same content and algorithm version, and outputs integer box and route coordinates. It does not compute a globally minimal crossing count or an optimal compact layout. There is no public spacing, sweep-count or cancellation option.

## Node and label sizing

`sizeOfNode` estimates and wraps labels at `LABEL_SIZE` 14 with `LABEL_LINE` 18; secondary text uses `SUB_SIZE` 12 with `SUB_LINE` 16. Ordinary label space is based on `NODE_MAX_WIDTH` 280 minus padding. Diamonds use a shorter text width and enlarge their box to contain the central text rectangle. Pill and cylinder shapes reserve extra room for their rounded ends or lid.

`NODE_MAX_WIDTH` is not a hard maximum for every shape's outer box. A diamond or shape padding can produce a wider box. `estimateTextWidth` uses a deterministic glyph-class estimate; it does not measure the host's font. `wrapText` collapses whitespace into words, including hard line breaks, and breaks words wider than the available width.

Edge labels wrap within `EDGE_LABEL_MAX_WIDTH` 160 and use `EDGE_LABEL_PADDING` of `{ x: 4, y: 2 }`. Node boxes include the wrapped `label` and `sub` arrays. Edge-label boxes include `lines`, so custom painters can draw exactly the lines that sizing used.

## Groups, routes and bounds

A group contains node ids, never groups. One node belongs to at most one group. A group's box adds `GROUP_PADDING` 20 and a `GROUP_LABEL_BAND` of 24; `GROUP_LABEL_INSET` is 12. Empty groups remain valid data but have no layout box.

Automatic routes use orthogonal corners. Edges that skip layers get intermediate routing units so they can pass through channels. Ports spread along node sides; endpoints account for shape outlines. Back edges reverse their route to retain source-to-target order. Parallel edges retain separate source indices even when their endpoints match.

Channels reserve room for edge labels and group boundaries, and can widen when labels need more columns. Routing aims to avoid unrelated boxes and reduce crossings. Dense routing can still cross edges. Label placement uses finite searches and fallback positions; it is not a general obstacle-avoidance guarantee for all possible documents.

`DiagramLayout.bounds` covers node boxes, groups, group labels, route corners and edge labels. Empty diagrams have `{ x: 0, y: 0, w: 0, h: 0 }`. Painted stroke widths and arrowhead extents are not independently expanded into these bounds; export margin supplies room around them.

## Manual positions

Set a node's optional `pos: [x, y]` to pin it. The layout rounds that position to integers and reports `pinned: true`. Remove `pos` to return to automatic placement.

```ts
import { layoutOf } from '@adecore/diagram';
import type { DiagramContent } from '@adecore/diagram/protocol';

const content: DiagramContent = {
    meta: { title: 'Pinned review', direction: 'down' },
    nodes: [
        { id: 'draft', label: 'Draft' },
        { id: 'review', label: 'Review', pos: [300.4, 200.6] }
    ],
    groups: [],
    edges: [{ from: 'draft', to: 'review', label: 'submit' }]
};
const layout = layoutOf(content);
console.log(layout.nodes.find((node) => node.id === 'review'));
```

Pinned nodes give up their automatic layer slot, while their graph layer number remains available. Edges involving a pin or same-layer pair use simpler loose orthogonal routes. Pins do not push automatic nodes out of their way. A group containing distant pinned nodes expands around them and can cover unrelated items. The host must manage overlaps and clipping for manual arrangements.
