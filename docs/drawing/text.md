# Text and reading order

A `text` and a `note` are both a `WrittenElement`: they carry `text`, a `size` and an optional `font` and `align`. Lines are `size * LINE_HEIGHT` apart, and `LINE_HEIGHT` is 1.25.

## Lines

`linesOf(element, measure)` returns the lines to draw:

| Element                | Lines                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `text` without `sized` | Its own line breaks only. The box follows the text, so the app grows it. |
| `text` with `sized`    | Wrapped to `w`.                                                          |
| `note`                 | Wrapped to the box minus `NOTE_PADDING` (16) on each side.               |

`writingFrameOf(element)` is where those lines start inside the element and how wide they may be. Wrapping breaks at spaces, and inside a word that is too long for a line. A note with more text than room runs past the bottom of its sheet; the app makes it taller.

`fontOf(font)` reads an absent font as `hand`. `DEFAULT_FONT_STACKS` names a stack per font: Kalam for `hand`, the system font for `sans` and the system monospace for `mono`. The package ships no font files.

## Measuring

A `MeasureLine` takes a line and returns its width in world units. `approximateMeasure(size, font)` estimates from the character count. That is fine for a backend, but wraps differently from a browser. To match what a person sees, give `toSvg` a measure from a canvas once the fonts have loaded:

```ts
import { DEFAULT_FONT_STACKS, DEFAULT_PALETTE, fontOf, toSvg } from '@adecore/drawing';

await document.fonts.ready;
const context = document.createElement('canvas').getContext('2d')!;

const svg = toSvg(elements, {
    palette: DEFAULT_PALETTE,
    measure: (element) => (line) => {
        context.font = `${element.size}px ${DEFAULT_FONT_STACKS[fontOf(element.font)]}`;
        return context.measureText(line).width;
    }
});
```

If you pass `fonts`, measure with those stacks too.

## Reading order

`readingOrder(elements)` turns a drawing into lines of plain text, for an agent or for a text alternative next to the canvas. The [demo on the overview](/drawing/) prints them under the drawing:

```
Idea
Review
Shipped
Ask for a second review when the change touches billing
Idea -> Review
Review -> Shipped
```

First come the texts and notes, in rows top to bottom and left to right within a row. Then every line with an arrow head becomes `from -> to`, in the direction the head points. Each end takes the name of the nearest text, note or labeled shape. An arrow with an unnamed end, or the same name at both ends, is left out.

It is a guess from positions. When the connections matter, keep them as data: [`@adecore/diagram`](/diagram/) stores edges and reads them back exactly.
