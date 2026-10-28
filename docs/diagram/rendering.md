# Painting and reading

## toSvg

```ts
import { layoutOf, toSvg } from '@adecore/diagram';

const layout = layoutOf(diagram);
const svg = toSvg(diagram, { layout, background: '#ffffff' });
```

`toSvg(content, options)` writes the diagram as one SVG string. Every option is optional:

| `DiagramSvgOptions` | Default                                  |                                                                   |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `palette`           | `DEFAULT_PALETTE` of the drawing package | The color of every palette name: outlines, edges and text.        |
| `paper`             | `DEFAULT_PAPER` of the drawing package   | The pale fill of a node, by its tone.                             |
| `background`        | None                                     | A rect behind everything, also used as a halo behind edge labels. |
| `margin`            | 32             | World units around the bounds.                                    |
| `font`              | The `sans` stack of the drawing package  | The font family of the whole SVG.                                 |
| `layout`            | `layoutOf(content)`                      | A layout you already computed, so it is not computed twice.       |

A passed layout must belong to this exact content. Cache it by revision and compute it again after any change.

Groups paint first, then edges and labels, then nodes. A node's outline takes its tone and its fill the paper of that tone. Its label is `ink` and its `sub` is `muted`. The defaults are `DEFAULT_GROUP_TONE` and `DEFAULT_EDGE_TONE` (`muted`) and `DEFAULT_NODE_TONE` (`ink`).

Colors go into the SVG as passed, and text is escaped. Resolve theme colors to plain values for a file that leaves the app. `meta.title` stays out of the SVG.

## A painter of your own

To draw the diagram as your own elements, so nodes can be dragged or selected, use the helpers `toSvg` uses:

| Helper                        | Returns                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `shapePaths(shape, box)`      | `ShapePaths`: the `body` to fill and outline, and a `detail` line on top, the front of a cylinder's lid, or `null`. |
| `textLinesOf(nodeBox, shape)` | The `TextLine`s of a node: `text`, `x`, `y`, `size`, and whether it is `bold` or `muted`. Centered on `x`.          |
| `edgeLabelLinesOf(label)`     | The `TextLine`s of an edge label.                                                                                   |
| `edgePath(points)`            | The path of an edge through its corners.                                                                            |
| `arrowHeadPath(points)`       | A filled triangle at the last point.                                                                                |
| `dashOf(style)`               | `null` for solid, `'8 6'` for dashed and `'2 5'` for dotted, for `stroke-dasharray`.                                |

All coordinates are world units. Draw the wrapped `label` and `sub` lines from the layout instead of wrapping again, so the text fits its box.

## readingOrder

`readingOrder(content)` writes the graph as lines of text. For the release diagram on the [overview](/diagram/):

```
Commit
Build (bun run build)
Test (bun test)
Approved?
Publish
Registry
Docs site
Commit -> Build
Build -> Test
Test -> Approved?: green
Approved? -> Publish: yes
Approved? -> Commit: changes
Publish -> Registry
Publish -> Docs site
CI wraps: Build, Test
```

Nodes come column by column, in file order within a column, with their `sub` in parentheses. Then come the edges in file order, with labels after a colon, and the groups. A node with an empty label shows its id. Dragging changes nothing here.
