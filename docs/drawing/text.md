# Text, fonts and reading order

## Text boxes and notes

`WrittenElement` is a text or note element. Its `text`, integer `size` and optional `font`/`align` control writing. Text sizes range from 12 through 96. `fontOf(undefined)` returns `hand`; missing alignment reads as left.

`LINE_HEIGHT` is `1.25`. `textLines` splits at LF and preserves empty paragraphs. `linesOf(element, measure)` chooses between those lines and wrapping:

| Element                    | Line layout                                           |
| -------------------------- | ----------------------------------------------------- |
| Text without `sized: true` | Explicit LF breaks only; its width does not wrap text |
| Sized text                 | Wrap to `w`                                           |
| Note                       | Wrap to the writing frame inside paper padding        |

`writingFrameOf` returns local `{ x, y, w }`. Text uses `{ x: 0, y: 0, w }`. Notes use `NOTE_PADDING` of 16 on each side and a writing width of at least one unit. `NOTE_RADIUS` is 8.

Wrapping is greedy, splits paragraphs on spaces and breaks oversized words between glyphs. It preserves hard LF breaks and emits at least one glyph even when the box is narrower than that glyph. It is not a full Unicode line-break or shaping engine. CRLF normalization belongs to the host before storing text.

Changing text does not resize the box. A host must measure content and decide how unsized boxes follow it. SVG text does not clip to the element's height, so text can overflow a short note.

## Font and measurement policy

`DEFAULT_FONT_STACKS` maps `hand` to Kalam with cursive fallbacks, `sans` to a system UI stack and `mono` to a system monospace stack. These are names, not supplied font assets. Load any desired font in the host and wait for it before measuring if export and canvas wrapping must agree.

`MeasureLine` is `(line: string) => number`, measured in world units at the element's chosen font and size. `approximateMeasure(size, font)` estimates width as character count times size times `0.6` for mono or `0.55` otherwise. It works on a backend without fonts but cannot reproduce every browser's glyph metrics.

```ts
import { approximateMeasure, linesOf, writingFrameOf } from '@adecore/drawing';
import type { DrawingElement } from '@adecore/drawing/protocol';

const note: DrawingElement & { kind: 'note' } = {
    kind: 'note',
    id: 'note',
    x: 0,
    y: 0,
    w: 180,
    h: 120,
    stroke: 'ink',
    strokeWidth: 1,
    seed: 1,
    text: 'Review the result\nThen save',
    size: 20,
    font: 'sans'
};
console.log(writingFrameOf(note));
console.log(linesOf(note, approximateMeasure(note.size, note.font)));
```

## Measure in a browser

The host can inject a real canvas measure into SVG export. This adapter needs a browser and already-loaded fonts; it is not a backend example.

```ts
import { DEFAULT_FONT_STACKS, DEFAULT_PALETTE, fontOf, toSvg } from '@adecore/drawing';
import type { WrittenElement } from '@adecore/drawing';
import type { DrawingElement } from '@adecore/drawing/protocol';

async function exportWithBrowserMetrics(elements: readonly DrawingElement[]): Promise<string> {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context === null) {
        throw new Error('A 2D context is required for font measurement');
    }
    return toSvg(elements, {
        palette: DEFAULT_PALETTE,
        measure: (element: WrittenElement) => {
            const family = DEFAULT_FONT_STACKS[fontOf(element.font)];
            return (line: string) => {
                context.font = `${element.size}px ${family}`;
                return context.measureText(line).width;
            };
        }
    });
}
```

Set the font for each measurement because one context serves multiple elements. If `SvgOptions.fonts` overrides a family, use that same family in this adapter. The detached canvas needs no listener cleanup.

## Reading order

`readingOrder(elements)` returns plain string lines. It collects nonblank text and note labels, sorts them by y and groups rows within 24 units of the row's top text. Within a row it reads left to right. Anchoring the tolerance to the row's first y prevents a staircase from chaining into one row.

After the labels, it adds labeled line-arrow connections. It infers endpoint names from nearby text/notes or text inside a shape, with a reach of 48 units. An end-only head reads forward; a start-only head reads backward. A line with both heads still reads forward once. Missing labels, equal endpoint names and headless lines produce no connection entry.

This is a spatial heuristic. It does not provide semantic grouping, exact rotated-endpoint inference, keyboard navigation or a verified screen-reader canvas. Line endpoints use unrotated absolute points. A host that requires authoritative graph relations should use [diagram documents](/diagram/) or store its own relationships.
