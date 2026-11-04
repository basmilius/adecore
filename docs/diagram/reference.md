# Reference

```ts
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';
import { diagramProblemIn, migrateDiagram, type DiagramDocument } from '@adecore/diagram/protocol';
```

## Limits and constants

| Name                 | Value                        | Explained in                                   |
| -------------------- | ---------------------------- | ---------------------------------------------- |
| `DIAGRAM_VERSION`    | `1`                          | [Documents](/diagram/documents)                |
| `DIAGRAM_LIMITS`     | `{ nodes: 100, edges: 120 }` | [Documents](/diagram/documents#checking-a-diagram) |
| `DIAGRAM_SHAPES`     | `rect`, `round`, `pill`, `diamond`, `cylinder` | [Documents](/diagram/documents) |
| `LABEL_SIZE`         | `14`                         | [Layout](/diagram/layout#sizes)                |
| `SUB_SIZE`           | `12`                         | [Layout](/diagram/layout#sizes)                |
| `GROUP_LABEL_BAND`   | `24`                         | [Layout](/diagram/layout#groups)               |
| `DEFAULT_NODE_TONE`  | `ink`                        | [Export to SVG](/diagram/rendering)            |
| `DEFAULT_GROUP_TONE` | `muted`                      | [Export to SVG](/diagram/rendering)            |
| `DEFAULT_EDGE_TONE`  | `muted`                      | [Export to SVG](/diagram/rendering)            |

The `DiagramSvgOptions` are on [Export to SVG](/diagram/rendering#options).

## Exports

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

### `@adecore/diagram`

The layout, the SVG export, the painter helpers and reading order.

<ExportTable entry="@adecore/diagram" />

### `@adecore/diagram/protocol`

The schemas and types of a diagram, `migrateDiagram` and `diagramProblemIn`. Loads Zod and the drawing protocol.

<ExportTable entry="@adecore/diagram/protocol" />
