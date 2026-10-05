# @adecore/drawing

Drawing schemas, world-coordinate geometry, deterministic paths, SVG export and reading order. The core needs no DOM or React canvas. Zod, Rough.js and perfect-freehand are declared dependencies.

The package is private at `0.0.0` pending initial publication. Use this checkout with the `source` condition or build compiled JavaScript/declarations in `dist`. The transferred code retains FSL-1.1-MIT in [LICENSE](./LICENSE); dependencies retain their own terms.

```ts
import { DEFAULT_PALETTE, readingOrder, toSvg } from '@adecore/drawing';
import { DrawingDocumentSchema, duplicateElementIdIn } from '@adecore/drawing/protocol';

const document = DrawingDocumentSchema.parse({
    version: 1,
    rev: 0,
    elements: [
        {
            kind: 'note',
            id: 'note',
            x: 0,
            y: 0,
            w: 180,
            h: 100,
            stroke: 'ink',
            strokeWidth: 1,
            seed: 7,
            fillColor: 'yellow',
            text: 'Review the result',
            size: 20
        }
    ]
});
if (duplicateElementIdIn(document.elements) !== null) {
    throw new Error('Element ids must be unique');
}
const svg = toSvg(document.elements, { palette: DEFAULT_PALETTE });
const lines = readingOrder(document.elements);
```

The host owns persistence, revision checks, selection, gestures, fonts and theme resolution. Parsing does not check duplicate ids. Bounds use stored unrotated boxes; verify rotated SVG output and clipping as described in the rendering guide. Colors supplied through SVG options are trusted host values.

Read the [overview](https://adecore.dev/drawing/), [getting started](https://adecore.dev/drawing/getting-started), [geometry guide](https://adecore.dev/drawing/geometry), [paths/SVG guide](https://adecore.dev/drawing/rendering), [text guide](https://adecore.dev/drawing/text), [API reference](https://adecore.dev/drawing/api), [protocol](https://adecore.dev/drawing/protocol) and [integration/testing guide](https://adecore.dev/drawing/migration).

From the repository root, run `bun run --cwd packages/drawing test`, `typecheck` or `build`. The [standalone example](./examples/export-drawing.ts) exports one validated note. Rough.js uses its official package entry for compiled Node execution.
