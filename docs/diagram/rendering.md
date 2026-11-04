# Export to SVG

`toSvg(content, options)` writes the diagram as one SVG string. It takes a document or its content.

```ts
import { layoutOf, toSvg } from '@adecore/diagram';

const layout = layoutOf(diagram);
const svg = toSvg(diagram, { layout, background: '#ffffff' });
```

## Options

| `DiagramSvgOptions` | Default                                  |                                                                   |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `palette`           | `DEFAULT_PALETTE` of the drawing package | The color of every palette name: outlines, edges and text.        |
| `paper`             | `DEFAULT_PAPER` of the drawing package   | The pale fill of a node, by its tone.                             |
| `background`        | None                                     | A rect behind everything, also used as a halo behind edge labels. |
| `margin`            | 32                                       | World units around the bounds.                                    |
| `font`              | The `sans` stack of the drawing package  | The font family of the whole SVG.                                 |
| `layout`            | `layoutOf(content)`                      | A layout you already computed, which `toSvg` then reuses.         |

A passed layout must belong to this exact content. Cache it by revision and compute it again after any change.

## What it paints

Groups paint first, then edges and labels, then nodes. A node's outline takes its tone and its fill the paper of that tone. Its label is `ink` and its `sub` is `muted`. The defaults are `DEFAULT_GROUP_TONE` and `DEFAULT_EDGE_TONE` (`muted`) and `DEFAULT_NODE_TONE` (`ink`).

## Colors

`toSvg` writes colors as passed and escapes text. Resolve theme colors to plain values for a file that leaves the app:

```ts
import { DEFAULT_PALETTE } from '@adecore/drawing';

const svg = toSvg(diagram, {
    palette: { ...DEFAULT_PALETTE, accent: '#7c3aed' },
    background: '#ffffff'
});
```

`meta.title` stays out of the SVG. To draw the diagram as elements a person can select or drag, see [A painter of your own](/diagram/painter).
