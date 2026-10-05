# @adecore/diagram

Directed graph schemas, deterministic layered layout, orthogonal routes, SVG export and reading order. The core has no DOM or canvas state. It depends on Zod and `@adecore/drawing` for shared schemas, geometry and palette defaults.

The package is private at `0.0.0` pending initial publication. Use local source exports or build drawing before diagram for default compiled JavaScript/declarations. The transferred code retains FSL-1.1-MIT in [LICENSE](./LICENSE).

```ts
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';
import { DiagramDocumentSchema, diagramProblemIn } from '@adecore/diagram/protocol';

const document = DiagramDocumentSchema.parse({
    version: 1,
    rev: 0,
    meta: { title: 'Delivery', direction: 'right' },
    nodes: [
        { id: 'draft', label: 'Draft' },
        { id: 'review', label: 'Review', shape: 'diamond' }
    ],
    groups: [],
    edges: [{ from: 'draft', to: 'review' }]
});
const problem = diagramProblemIn(document);
if (problem !== null) {
    throw new Error(problem);
}
const layout = layoutOf(document);
const svg = toSvg(document, { layout });
const lines = readingOrder(document);
```

Graph validation is separate from parsing. It caps documents at 100 nodes/120 edges and checks ids and references. Cycles, loops and parallel edges are supported. Pins keep manual positions but do not reserve automatic-layout space. The host owns dragging, collision policy, fonts, persistence and revision checks.

Read the [overview](https://adecore.dev/diagram/), [getting started](https://adecore.dev/diagram/getting-started), [layout guide](https://adecore.dev/diagram/layout), [painting/output guide](https://adecore.dev/diagram/rendering), [API reference](https://adecore.dev/diagram/api), [protocol](https://adecore.dev/diagram/protocol) and [integration/testing guide](https://adecore.dev/diagram/migration).

From the repository root, run `bun run --cwd packages/diagram test`, `typecheck` or `build`. A standalone source-relative example is in [examples/export-graph.ts](./examples/export-graph.ts).
