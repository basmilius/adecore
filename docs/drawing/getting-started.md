# Getting started

Parse stored JSON through the protocol entry point, then check element ids separately. Rendering does not validate documents for you.

```ts
import { DEFAULT_PALETTE, elementAt, pathsOfElement, readingOrder, toSvg } from '@adecore/drawing';
import { DrawingDocumentSchema, duplicateElementIdIn } from '@adecore/drawing/protocol';

const document = DrawingDocumentSchema.parse({
    version: 1,
    rev: 0,
    elements: [
        {
            kind: 'rect',
            id: 'box',
            x: 0,
            y: 0,
            w: 180,
            h: 100,
            stroke: 'blue',
            strokeWidth: 2,
            seed: 7,
            fill: 'hachure',
            roughness: 1
        },
        {
            kind: 'note',
            id: 'note',
            x: 220,
            y: 0,
            w: 180,
            h: 100,
            stroke: 'ink',
            strokeWidth: 1,
            seed: 9,
            fillColor: 'yellow',
            text: 'Review & confirm <result>',
            size: 20,
            font: 'sans'
        }
    ]
});
const duplicate = duplicateElementIdIn(document.elements);
if (duplicate !== null) {
    throw new Error(`Duplicate element id: ${duplicate}`);
}

const paths = pathsOfElement(document.elements[0]!);
const selected = elementAt(document.elements, { x: 240, y: 20 }, 6);
const svg = toSvg(document.elements, { palette: DEFAULT_PALETTE, background: '#ffffff' });
const text = readingOrder(document.elements);
console.log(paths.some((path) => path.role === 'fill'));
console.log(selected?.id);
console.log(svg.includes('&amp;') && svg.includes('&lt;result&gt;'));
console.log(text);
```

This yields a hachure fill, selects `note`, escapes its text and reads the note's label. Export follows the array's back-to-front stacking order. The note is one element, so its text moves with its paper.

The geometry and renderer take elements, not the whole document. The host retains `version` and `rev` when saving. A parsed revision is data; the package does not check it against storage or increment it.

## Local source and compiled imports

The package is currently private. Use a workspace dependency or link the local checkout. Enable `source` in the bundler's export conditions and TypeScript's `customConditions` when reading TypeScript; Bun supports `--conditions=source`.

Default imports use compiled JavaScript and declarations. Build from the Adecore repository root:

```sh
bun run --cwd packages/drawing build
```

`@adecore/drawing/protocol` loads Zod without the renderer. The root loads rendering dependencies but requires no browser globals. Node and Bun can export SVG without a canvas or font engine. For matching browser text metrics, supply the [measurement adapter](./text#measure-in-a-browser).

TypeScript source checking uses `moduleResolution: 'bundler'`, `customConditions: ['source']` and `allowImportingTsExtensions: true`. Use default compiled exports with `NodeNext` resolution for a Node consumer; Rough.js's source declarations do not resolve the same way under `NodeNext` source checking.
