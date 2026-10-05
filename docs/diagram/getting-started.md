# Getting started

Parse the document, validate graph relationships, then compute a layout. A successful schema parse alone does not prove that an edge's node exists.

```ts
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';
import { DiagramDocumentSchema, diagramProblemIn } from '@adecore/diagram/protocol';

const document = DiagramDocumentSchema.parse({
    version: 1,
    rev: 0,
    meta: { title: 'Delivery', direction: 'right' },
    nodes: [
        { id: 'draft', label: 'Draft', shape: 'round', tone: 'blue' },
        { id: 'review', label: 'Review', sub: 'Check & confirm', shape: 'diamond' },
        { id: 'archive', label: 'Archive', shape: 'cylinder' }
    ],
    groups: [{ id: 'delivery', label: 'Delivery work', wraps: ['draft', 'review'] }],
    edges: [
        { from: 'draft', to: 'review', label: 'submit' },
        { from: 'review', to: 'archive', label: 'accepted', style: 'dashed' },
        { from: 'review', to: 'draft', label: 'revise' }
    ]
});
const problem = diagramProblemIn(document);
if (problem !== null) {
    throw new Error(problem);
}

const layout = layoutOf(document);
const svg = toSvg(document, { layout, background: '#ffffff' });
const lines = readingOrder(document);
console.log(layout.nodes.map((node) => [node.id, node.layer]));
console.log(layout.edges.length === document.edges.length);
console.log(svg.includes('Check &amp; confirm'));
console.log(lines);
```

The cycle is allowed. The layout deterministically omits back edges from layer ranking but still draws every validated edge. Passing `layout` to `toSvg` avoids computing it again; it must belong to this exact document content.

`meta.title` is persisted metadata. SVG export does not add a title element or visible heading automatically. The host can display the title and attach an accessible description.

## Local source and compiled use

The package is currently private at `0.0.0`. Use local workspace dependencies or linked packages. Enable `source` in the bundler and TypeScript's `customConditions` when using source exports; Bun supports `--conditions=source`.

Compiled diagram builds read drawing's declaration exports. From the repository root, build in dependency order:

```sh
bun run --cwd packages/drawing build
bun run --cwd packages/diagram build
```

Default imports then resolve `dist`. The root works in browsers, Node and Bun without a canvas or font engine. The protocol entry point imports shared drawing schemas and Zod without loading layout or renderers.

TypeScript source checking uses `moduleResolution: 'bundler'`, `customConditions: ['source']` and `allowImportingTsExtensions: true`. For `NodeNext` consumers, use default compiled exports; drawing's Rough.js declarations have a different source-resolution behavior under `NodeNext`.
