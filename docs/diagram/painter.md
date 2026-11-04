# A painter of your own

To draw the diagram as your own elements, so nodes can be dragged or selected, take the boxes from [`layoutOf`](/diagram/layout) and paint them with the helpers `toSvg` uses.

## Helpers

| Helper                        | Returns                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `shapePaths(shape, box)`      | `ShapePaths`: the `body` to fill and outline, and a `detail` line on top, the front of a cylinder's lid, or `null`. |
| `textLinesOf(nodeBox, shape)` | The `TextLine`s of a node: `text`, `x`, `y`, `size`, and whether it is `bold` or `muted`. Centered on `x`.          |
| `edgeLabelLinesOf(label)`     | The `TextLine`s of an edge label.                                                                                   |
| `edgePath(points)`            | The path of an edge through its corners.                                                                            |
| `arrowHeadPath(points)`       | A filled triangle at the last point.                                                                                |
| `dashOf(style)`               | `null` for solid, `'8 6'` for dashed and `'2 5'` for dotted, for `stroke-dasharray`.                                |

All coordinates are world units. Draw the wrapped `label` and `sub` lines from the layout instead of wrapping again, so the text fits its box.

## An example in React

```tsx
import { arrowHeadPath, dashOf, edgeLabelLinesOf, edgePath, layoutOf, shapePaths, textLinesOf } from '@adecore/diagram';
import type { DiagramContent } from '@adecore/diagram/protocol';

export function DiagramPicture({ diagram }: { diagram: DiagramContent }) {
    const layout = layoutOf(diagram);
    const { x, y, w, h } = layout.bounds;

    return (
        <svg viewBox={`${x} ${y} ${w} ${h}`}>
            {layout.edges.map((route) => (
                <g key={route.index}>
                    <path d={edgePath(route.points)} fill="none" stroke="currentColor" strokeDasharray={dashOf(diagram.edges[route.index]!.style) ?? undefined} />
                    <path d={arrowHeadPath(route.points)} fill="currentColor" />
                    {route.label &&
                        edgeLabelLinesOf(route.label).map((line, i) => (
                            <text key={i} x={line.x} y={line.y} fontSize={line.size} textAnchor="middle">
                                {line.text}
                            </text>
                        ))}
                </g>
            ))}
            {layout.nodes.map((box, i) => {
                const shape = diagram.nodes[i]!.shape;
                const paths = shapePaths(shape, box);

                return (
                    <g key={box.id}>
                        <path d={paths.body} fill="white" stroke="currentColor" />
                        {paths.detail && <path d={paths.detail} fill="none" stroke="currentColor" />}
                        {textLinesOf(box, shape).map((line, j) => (
                            <text key={j} x={line.x} y={line.y} fontSize={line.size} fontWeight={line.bold ? 600 : undefined} opacity={line.muted ? 0.6 : undefined} textAnchor="middle">
                                {line.text}
                            </text>
                        ))}
                    </g>
                );
            })}
        </svg>
    );
}
```

Layout nodes and edges come in file order, so `layout.nodes[i]` belongs to `diagram.nodes[i]` and `route.index` points into `diagram.edges`. This example leaves out groups; paint each `GroupBox` behind the edges, with its label in `labelBox`.
