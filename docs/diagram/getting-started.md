# Getting started

## Install

```sh
bun add @adecore/diagram
```

The package has no peer dependencies. It brings Zod and [`@adecore/drawing`](/drawing/). A store that only validates files imports `@adecore/diagram/protocol`, which loads Zod and the drawing protocol, without the layout or the renderer:

| Entry point                 | Holds                                                     |
| --------------------------- | --------------------------------------------------------- |
| `@adecore/diagram/protocol` | Zod schemas, types, `migrateDiagram`, `diagramProblemIn`  |
| `@adecore/diagram`          | Layout, the SVG export, painter helpers and reading order |

## Write a diagram

Start from `EMPTY_DIAGRAM` and list the nodes and edges. Nodes need no position:

```ts
import { EMPTY_DIAGRAM, diagramProblemIn, type DiagramDocument } from '@adecore/diagram/protocol';

let diagram: DiagramDocument = {
    ...EMPTY_DIAGRAM,
    meta: { title: 'Review', direction: 'right' },
    nodes: [
        { id: 'draft', label: 'Draft' },
        { id: 'review', label: 'Review', shape: 'diamond', tone: 'orange' },
        { id: 'merged', label: 'Merged', shape: 'pill', tone: 'green' }
    ],
    edges: [
        { from: 'draft', to: 'review' },
        { from: 'review', to: 'merged', label: 'approved' }
    ]
};

const problem = diagramProblemIn(diagram);
// null
```

`diagramProblemIn` checks what the schema cannot, such as an edge to a node that does not exist.

## Change it

A change is a new document with `rev` one higher. Add an edge back from `review` to `draft`:

```ts
diagram = {
    ...diagram,
    rev: diagram.rev + 1,
    edges: [...diagram.edges, { from: 'review', to: 'draft', label: 'changes', style: 'dashed' }]
};
```

Check it again before you store it. An edge to an unknown id comes back as a sentence:

```ts
diagramProblemIn({ ...diagram, edges: [...diagram.edges, { from: 'review', to: 'deploy' }] });
// 'The edge from "review" to "deploy" names "deploy", which is not a node'
```

## Export it

```ts
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';

const layout = layoutOf(diagram);
const svg = toSvg(diagram, { layout, background: '#ffffff' });
const lines = readingOrder(diagram);
```

`layoutOf` puts `draft`, `review` and `merged` in columns 0, 1 and 2. The edge back to `draft` closes a cycle; the layout ranks without it and still draws it. Pass the layout to `toSvg` so `toSvg` does not compute it twice. `readingOrder` returns:

```
Draft
Review
Merged
Draft -> Review
Review -> Merged: approved
Review -> Draft: changes
```

## Read it back

```ts
import { diagramProblemIn, migrateDiagram } from '@adecore/diagram/protocol';

const loaded = migrateDiagram(JSON.parse(file));
const problem = loaded && diagramProblemIn(loaded);

if (loaded === null || problem) {
    throw new Error(problem ?? 'Not a diagram');
}
```

## Checklist

- Every file goes through `migrateDiagram` and `diagramProblemIn`, and the problem goes back to whoever wrote it.
- Every saved change raises `rev` by one.
- A cached layout belongs to one revision, and a change computes it again.
- An export outside the page gets plain colors in its palette, not CSS variables.
