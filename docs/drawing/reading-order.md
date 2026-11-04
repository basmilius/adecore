# Reading order

`readingOrder(elements)` turns a drawing into lines of plain text. An agent reads a drawing that way, and a page can show the lines as a text alternative next to the canvas.

```ts
import { readingOrder } from '@adecore/drawing';

const lines = readingOrder(drawing.elements);
```

The [demo on the overview](/drawing/) prints them under the drawing:

```
Idea
Review
Shipped
Ask for a second review when the change touches billing
Idea -> Review
Review -> Shipped
```

## How it reads

First come the texts and notes, in rows top to bottom and left to right within a row. Texts whose tops are within 24 units of the first text in a row share that row.

Then every line with an arrow head becomes `from -> to`, in the direction the head points. Each end takes the name of the nearest text, note or labeled shape that the end touches or ends close to. A shape is labeled when a text sits inside it. It leaves out an arrow with an unnamed end, or with the same name at both ends.

So an arrow reads only when its ends touch what it points at:

```ts
const elements = [
    { kind: 'note', id: 'a', x: 0, y: 0, w: 160, h: 100, text: 'Idea', stroke: 'ink', strokeWidth: 2, seed: 1 },
    { kind: 'note', id: 'b', x: 280, y: 0, w: 160, h: 100, text: 'Review', stroke: 'ink', strokeWidth: 2, seed: 2 },
    { kind: 'line', id: 'c', x: 160, y: 50, w: 120, h: 0, points: [[0, 0], [120, 0]], arrowEnd: true, stroke: 'ink', strokeWidth: 2, seed: 3 }
];

readingOrder(elements);
// ['Idea', 'Review', 'Idea -> Review']
```

## When it is not enough

It is a guess from positions. When the connections matter, keep them as data. [`@adecore/diagram`](/diagram/) stores edges and reads them back exactly.
