# Painting and reading output

## Custom painters

Compute one `DiagramLayout` and use its output boxes and routes to paint. `shapePaths(shape, box)` returns a filled `body` outline and optional unfilled `detail`. Shape defaults to `rect`; supported shapes are rect, round, pill, diamond and cylinder. Only a cylinder has a separate lid detail.

`textLinesOf(nodeBox, shape)` returns `TextLine[]` with text, coordinates, size, bold and muted flags. `edgeLabelLinesOf(labelBox)` does the same for an edge label. These coordinates are world-space positions. Node and edge text are centered; cylinder text sits below its lid. A painter should use the wrapped arrays in the layout instead of wrapping the original label again.

`edgePath(points)` joins route corners with straight path segments. `arrowHeadPath(points)` creates a filled triangular head at the final point; call it only with a nonempty route. `dashOf` returns `null`, `'8 6'` or `'2 5'` for solid, dashed or dotted styles.

## SVG options and shared drawing types

`toSvg(content, options = {})` returns SVG without a DOM. It uses the drawing package's `DrawingColor` names, `DEFAULT_PALETTE`, `DEFAULT_PAPER` and sans font stack. `Point` and `Rect` exported by diagram are the same geometry types exported by drawing.

| `DiagramSvgOptions` field | Default                      | Purpose                                 |
| ------------------------- | ---------------------------- | --------------------------------------- |
| `palette`                 | Drawing `DEFAULT_PALETTE`    | Strokes and text by palette name        |
| `paper`                   | Drawing `DEFAULT_PAPER`      | Pale node fills by tone                 |
| `background`              | Transparent                  | Page rectangle and edge-label text halo |
| `margin`                  | `DEFAULT_DIAGRAM_MARGIN`, 32 | World units around layout bounds        |
| `font`                    | Drawing sans stack           | SVG-wide font family                    |
| `layout`                  | `layoutOf(content)`          | Reuse a current layout                  |

Default node tone is `ink`; group and edge tone are `muted`, exposed as `DEFAULT_NODE_TONE`, `DEFAULT_GROUP_TONE` and `DEFAULT_EDGE_TONE`. Node main text uses palette ink and secondary text uses muted even when a node has another outline tone.

```ts
import { DEFAULT_PALETTE, DEFAULT_PAPER } from '@adecore/drawing';
import { layoutOf, toSvg } from '@adecore/diagram';
import type { DiagramContent } from '@adecore/diagram/protocol';

const content: DiagramContent = {
    meta: { title: 'Theme export', direction: 'right' },
    nodes: [{ id: 'start', label: 'Start', tone: 'accent' }],
    groups: [],
    edges: []
};
const layout = layoutOf(content);
const svg = toSvg(content, {
    layout,
    palette: { ...DEFAULT_PALETTE, accent: '#3344aa' },
    paper: DEFAULT_PAPER,
    background: '#ffffff',
    font: 'system-ui, sans-serif'
});
console.log(svg.startsWith('<svg'));
```

Supply resolved colors for portable files. CSS variables need a host style context. The font name is not embedded, and there is no measurement override in diagram layout: changing the export font does not recompute exact glyph widths.

SVG paints groups first, then edges and their labels, then nodes and node text. It escapes document labels and the font string and removes XML-forbidden control characters. Palette, paper and background values are trusted attribute values; keep them under host control. `meta.title` does not become an SVG title automatically. Empty layouts export just the margin-sized viewBox, which is 64 by 64 with defaults.

A supplied layout is trusted. Reusing it after graph edits can give wrong boxes, edge indices or missing ids. Cache by content identity/revision and invalidate it whenever labels, groups, edges, direction, shapes or pins change.

## Reading order

`readingOrder(content)` returns plain lines from the graph, independently of visual coordinates:

1. Nodes in increasing layer order, using file order within a layer. Secondary labels appear in parentheses. A blank node label falls back to the id.
2. Edges in file order as `Source -> Target`, with `: label` when present.
3. Groups in file order as `Group wraps: Member, Member`.

Manual pins do not change this order. Cycles use the same ranking as layout. Unlike [drawing reading order](/drawing/text#reading-order), connections come from explicit graph data rather than spatial inference.

These lines are suitable for a text export or a host-provided alternative view. The core does not add ARIA metadata, keyboard navigation or a screen-reader-tested canvas. Render a host title and alternative output where needed.
