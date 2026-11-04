# Getting started

This page creates a drawing, changes it, exports it as SVG and reads it back from a file.

## Install

```sh
bun add @adecore/drawing
```

The package has no peer dependencies. It brings Zod, [Rough.js](https://roughjs.com) and [perfect-freehand](https://github.com/steveruizok/perfect-freehand). A store that only validates files imports `@adecore/drawing/protocol`, which loads Zod alone:

| Entry point                 | Holds                                                       | Loads                         |
| --------------------------- | ----------------------------------------------------------- | ----------------------------- |
| `@adecore/drawing/protocol` | Zod schemas, types, `migrateDrawing`                        | Zod                           |
| `@adecore/drawing`          | Edits, geometry, paths, SVG, text and reading order         | Rough.js and perfect-freehand |

## Create a drawing

Start from a copy of `EMPTY_DRAWING` and add elements with an edit. `applyDrawingEdit` fills in the id and seed of each new element through a mint the app provides:

```ts
import { applyDrawingEdit, type DrawingEditMint } from '@adecore/drawing';
import { EMPTY_DRAWING, type DrawingDocument } from '@adecore/drawing/protocol';

const mint: DrawingEditMint = {
    id: () => crypto.randomUUID(),
    seed: () => Math.floor(Math.random() * 2 ** 31)
};

let drawing: DrawingDocument = { ...EMPTY_DRAWING, elements: [] };

const added = applyDrawingEdit(
    drawing.elements,
    {
        add: [
            { kind: 'note', x: 0, y: 0, w: 160, h: 100, text: 'Idea', fillColor: 'yellow' },
            { kind: 'note', x: 280, y: 0, w: 160, h: 100, text: 'Shipped', fillColor: 'green' },
            { kind: 'line', x: 160, y: 50, w: 120, h: 0, points: [[0, 0], [120, 0]], arrowEnd: true }
        ]
    },
    mint
);

if (!added.ok) {
    throw new Error(added.problems.map((problem) => problem.message).join('\n'));
}

drawing = { ...drawing, rev: drawing.rev + 1, elements: added.elements };
const [idea, shipped, arrow] = added.added;
```

`added.added` holds the new ids in the order of `add`. A new element without a `stroke` is `ink`, 2 wide, and a note without a `size` is 20.

## Change it

An update names an element by id and lists only the fields that change:

```ts
const renamed = applyDrawingEdit(drawing.elements, { update: [{ id: shipped, text: 'Review' }] }, mint);

if (renamed.ok) {
    drawing = { ...drawing, rev: drawing.rev + 1, elements: renamed.elements };
}
```

The edit is all or nothing. A field the element's kind does not have, such as `text` on the arrow, returns `{ ok: false, problems }` with the path `['update', 0, 'text']` and leaves the drawing as it was. [Edits and rebasing](/drawing/edits) has the rules.

## Export it

```ts
import { DEFAULT_PALETTE, readingOrder, toSvg } from '@adecore/drawing';

const svg = toSvg(drawing.elements, { palette: DEFAULT_PALETTE, background: '#ffffff' });
const lines = readingOrder(drawing.elements);
// ['Idea', 'Review', 'Idea -> Review']
```

`toSvg` returns one SVG string sized to the elements plus a margin. `readingOrder` reads the two notes and the arrow between them. [Paths and SVG](/drawing/rendering) covers the options, and how to paint on a canvas of your own instead.

## Read it back

Store the document as JSON. When you load it, parse it and look for duplicate ids, which the schema cannot see:

```ts
import { duplicateElementIdIn, migrateDrawing } from '@adecore/drawing/protocol';

const loaded = migrateDrawing(JSON.parse(file));

if (loaded === null || duplicateElementIdIn(loaded.elements) !== null) {
    throw new Error('Not a drawing');
}
```

## Checklist

- The app makes the ids and seeds of new elements, and an id is never one the drawing holds.
- Every saved change raises `rev` by one, and the app compares `rev` with the stored one before it writes.
- Every loaded file goes through `migrateDrawing` and `duplicateElementIdIn`.
- An export outside the page gets plain colors in its palette, not CSS variables.
