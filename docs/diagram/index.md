# @adecore/diagram

Schemas and deterministic layout for directed graphs with optional groups. The package computes node boxes, orthogonal edge routes, labels and bounds, then produces SVG or plain reading-order lines. It has no DOM or canvas state.

Use diagrams when the document should describe connections directly. Use [drawing](/drawing/) when people need freehand elements and arbitrary shapes. Diagram shares drawing's palette names, geometry types and export defaults through an explicit runtime dependency.

The package is private at `0.0.0` pending initial publication. Its transferred code retains [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/diagram/LICENSE). Zod validates structure; a separate graph check validates ids, references and limits.

## Read the documentation

- [Getting started](./getting-started) validates a graph and exports a reused layout.
- [Layers, groups and layout](./layout) explains cycles, ordering, directions, routes and pinned positions.
- [Painting and reading output](./rendering) covers shapes, text positions, SVG options and reading order.
- [API reference](./api) groups every root export.
- [Diagram protocol](./protocol) describes schemas and graph checks.
- [Integration, migration and testing](./migration) covers persistence, host boundaries and troubleshooting.

The [standalone graph example](https://github.com/basmilius/adecore/blob/main/packages/diagram/examples/export-graph.ts) runs without a UI. A host provides dragging, selection, fonts, theme resolution, editing permissions and storage.
