# API reference

The groups below are exported from `@adecore/diagram`. Persisted schemas and graph validation are on [the protocol entry point](./protocol). Root functions are synchronous and perform no I/O.

## Layout and sizing

| Export            | Signature or shape                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Point`, `Rect`   | Shared drawing types, `{ x, y }` and `{ x, y, w, h }`                                                                   |
| `NodeSize`        | `{ w; h; label: string[]; sub: string[] }`                                                                              |
| `NodeBox`         | `Rect` plus `id`, `layer`, `pinned`, `label`, `sub`                                                                     |
| `GroupBox`        | `Rect` plus `id` and `labelBox: Rect`                                                                                   |
| `EdgeLabelBox`    | `Rect` plus `lines: string[]`                                                                                           |
| `EdgeRoute`       | `{ index; from; to; points: Point[]; label: EdgeLabelBox \| null }`                                                     |
| `DiagramLayout`   | `{ nodes: NodeBox[]; groups: GroupBox[]; edges: EdgeRoute[]; bounds: Rect }`                                            |
| `sizeOfNode`      | `(node: Pick<DiagramNode, 'label' \| 'sub' \| 'shape'>): NodeSize`                                                      |
| `sizeOfEdgeLabel` | `(text: string): { w: number; h: number; lines: string[] }`                                                             |
| `layersOf`        | `(nodes: readonly Pick<DiagramNode, 'id'>[], edges: readonly Pick<DiagramEdge, 'from' \| 'to'>[]): Map<string, number>` |
| `layoutOf`        | `(content: Pick<DiagramDocument, 'meta' \| 'nodes' \| 'groups' \| 'edges'>): DiagramLayout`                             |

Exported sizing constants are `NODE_MAX_WIDTH` 280, `CYLINDER_LID` 10, `EDGE_LABEL_MAX_WIDTH` 160, `EDGE_LABEL_PADDING` `{ x: 4, y: 2 }`, `GROUP_PADDING` 20, `GROUP_LABEL_BAND` 24 and `GROUP_LABEL_INSET` 12. See [layout limits](./layout) before interpreting these as hard outer bounds.

## Text and paths

| Export                                             | Signature or shape                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `LABEL_SIZE`, `LABEL_LINE`, `SUB_SIZE`, `SUB_LINE` | `14`, `18`, `12`, `16`                                                                                 |
| `estimateTextWidth`                                | `(text: string, size: number, bold = false): number`                                                   |
| `wrapText`                                         | `(text: string, size: number, bold: boolean, maxWidth: number): string[]`                              |
| `ShapePaths`                                       | `{ body: string; detail: string \| null }`                                                             |
| `shapePaths`                                       | `(shape: DiagramShape \| undefined, box: Rect): ShapePaths`                                            |
| `TextLine`                                         | `{ text; x; y; size; bold: boolean; muted: boolean }`                                                  |
| `textLinesOf`                                      | `(box: Pick<NodeBox, 'x' \| 'y' \| 'w' \| 'h' \| 'label' \| 'sub'>, shape?: DiagramShape): TextLine[]` |
| `edgeLabelLinesOf`                                 | `(label: EdgeLabelBox): TextLine[]`                                                                    |
| `edgePath`                                         | `(points: readonly Point[]): string`                                                                   |
| `arrowHeadPath`                                    | `(points: readonly Point[]): string`; requires a nonempty route                                        |
| `dashOf`                                           | `(style: DiagramEdgeStyle \| undefined): string \| null`                                               |

## Output

| Export                                    | Signature or shape                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DiagramSvgOptions`                       | Optional palette, paper, background, margin, font and reusable layout                                             |
| `DEFAULT_DIAGRAM_MARGIN`                  | `32`                                                                                                              |
| `DEFAULT_NODE_TONE`                       | `ink`                                                                                                             |
| `DEFAULT_GROUP_TONE`, `DEFAULT_EDGE_TONE` | `muted`                                                                                                           |
| `toSvg`                                   | `(content: Pick<DiagramDocument, 'meta' \| 'nodes' \| 'groups' \| 'edges'>, options?: DiagramSvgOptions): string` |
| `readingOrder`                            | `(content: Pick<DiagramDocument, 'nodes' \| 'groups' \| 'edges'>): string[]`                                      |

Options and layout reuse are described in [Painting and reading output](./rendering). Sources: [layout](https://github.com/basmilius/adecore/blob/main/packages/diagram/src/layout.ts), [shapes](https://github.com/basmilius/adecore/blob/main/packages/diagram/src/shapes.ts), [SVG](https://github.com/basmilius/adecore/blob/main/packages/diagram/src/svg.ts) and [reading order](https://github.com/basmilius/adecore/blob/main/packages/diagram/src/reading-order.ts).
