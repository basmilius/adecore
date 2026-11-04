# Text

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

A `MeasureLine` takes a line and returns its width in world units. `approximateMeasure(size, font)` estimates from the character count. That suffices for a backend, but it wraps differently from a browser. To match what a person sees, give `toSvg` a measure from a canvas once the fonts have loaded:

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

## Text for a reader

To turn a drawing into lines of text, for an agent or a screen reader, see [Reading order](/drawing/reading-order).
