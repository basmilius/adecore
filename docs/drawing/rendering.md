# Paths and SVG

## Deterministic local paths

`pathsOfElement` returns `ElementPath[]` in an element's local frame. Each path has `d`, `role`, `strokeWidth` and `dash`. Color resolution happens in the painter.

| Role     | Paint                                                     |
| -------- | --------------------------------------------------------- |
| `stroke` | Outline using the element's stroke palette color          |
| `fill`   | Shape fill using `fillColor`, or stroke color when absent |
| `ink`    | Filled freehand outline using the stroke palette color    |

Position and angle do not alter path commands. For a custom painter, translate by `(x, y)` and rotate local paths around `(w / 2, h / 2)`. Cache by the geometry and styling fields that affect paths, rather than by id alone.

Rough.js draws rect, diamond, ellipse and line paths. `seed` is required and stored; the renderer passes `seed + 1` to Rough.js. Identical geometry, styles and seeds produce identical paths with the same dependency version. Do not regenerate a seed on each render. Byte-identical output across future dependency upgrades is not a format guarantee.

Roughness `0` gives straight single strokes, absent/`1` gives the default wobble, and `2` increases roughness and bowing. `fill: 'solid'` supplies solid fill; `hachure` supplies fill strokes with gap 8; absent/`none` has no fill. Dashed strokes use `[strokeWidth * 4, strokeWidth * 4]`, dotted strokes use `[strokeWidth, strokeWidth * 3]`. Arrowheads remain solid.

## Freehand, text and notes

Freehand paths come from perfect-freehand and use relative point pressure, defaulting missing values to `0.5`. When every pressure is absent, the renderer simulates pressure from speed. The outline uses size `strokeWidth * 4 + 2`, thinning `0.6`, smoothing `0.5` and streamline `0.5`. It is one filled `ink` path; roughness, fill and dash styling do not redraw it as a rough shape.

`outlineToPath` closes an outline with `Z`; an empty outline produces `''`. `freehandOutline` returns the generated local outline string.

Text has no paths. The painter renders glyphs separately. Notes always have smooth paper and edge paths with `NOTE_RADIUS`, then render text over them. Note paper comes from its own palette even when no `fill` field is set. Roughness and seed do not wobble the note.

## Export options

`toSvg(elements, options)` returns an SVG string. `options.palette` is required and must map every `DrawingColor` to a host-approved value.

| `SvgOptions` field | Default                  | Purpose                                  |
| ------------------ | ------------------------ | ---------------------------------------- |
| `palette`          | Required                 | Stroke, ordinary fill and text colors    |
| `paper`            | `DEFAULT_PAPER`          | Note paper by palette name               |
| `edge`             | `DEFAULT_EDGE`           | Note edge by palette name                |
| `background`       | Transparent              | Optional page rectangle; `null` omits it |
| `margin`           | `DEFAULT_SVG_MARGIN`, 32 | World units around stored bounds         |
| `fonts`            | `DEFAULT_FONT_STACKS`    | Partial font-name overrides              |
| `measure`          | `approximateMeasure`     | Per-written-element line measurement     |

Use `DEFAULT_PALETTE` for a backend fallback. For exports that should match a theme, resolve theme tokens to actual color strings first. CSS variables can work in an embedded SVG but may not resolve when the SVG is opened elsewhere. Supply the note paper and edge palettes as well if the host uses different sheets.

```ts
import { DEFAULT_EDGE, DEFAULT_PALETTE, DEFAULT_PAPER, toSvg } from '@adecore/drawing';
import type { DrawingElement } from '@adecore/drawing/protocol';

const elements: DrawingElement[] = [
    { kind: 'ellipse', id: 'shape', x: 0, y: 0, w: 100, h: 60, stroke: 'accent', strokeWidth: 2, seed: 42, roughness: 0, fill: 'solid' }
];
const svg = toSvg(elements, {
    palette: { ...DEFAULT_PALETTE, accent: '#3344aa' },
    paper: DEFAULT_PAPER,
    edge: DEFAULT_EDGE,
    background: null,
    margin: 48,
    fonts: { hand: 'cursive' }
});
console.log(svg.startsWith('<svg'));
```

## XML and current export limits

Text and font-family strings escape XML markup and remove XML-forbidden control characters. Palette, paper, edge and background values are trusted host options inserted directly into attributes. They are not sanitized inputs. Keep user document values restricted to protocol palette names and validate host theme values before export.

The SVG preserves stacking order and names fonts without embedding or downloading them. Empty elements use a one-unit box plus the margin. Bounds exclude rotated corners, stroke extents and text overflow, so the caller may need more margin.

The current SVG transform combines a translation with a rotation around the world-space center. At a nonzero origin, that pivot does not match the local path frame used by a custom painter and hit testing. Verify rotated exports before adopting them; a host that needs exact rotated output can paint `pathsOfElement` with a local-center rotation. This limitation does not change persisted angle units.

There is no SVG importer, rasterizer or automatic accessible description. For text alternatives, use [reading order](./text#reading-order) and add the host's own title or description around the result.
