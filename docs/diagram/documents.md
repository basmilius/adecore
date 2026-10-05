# Documents

A diagram is a title, a direction, and three lists: nodes, groups and edges. The schemas and types are on `@adecore/diagram/protocol`.

```json
{
    "version": 1,
    "rev": 0,
    "meta": { "title": "Release", "direction": "right" },
    "nodes": [
        { "id": "build", "label": "Build", "sub": "bun run build" },
        { "id": "approved", "label": "Approved?", "shape": "diamond", "tone": "orange" }
    ],
    "groups": [{ "id": "ci", "label": "CI", "wraps": ["build"] }],
    "edges": [{ "from": "build", "to": "approved", "label": "green" }]
}
```

`DiagramDocumentSchema` is that object, with `version` at `DIAGRAM_VERSION` (1) and a `rev` the app raises on every save. `DiagramContentSchema` is the same without `version` and `rev`. `EMPTY_DIAGRAM` has an empty title, runs right and has empty lists; copy it before you change it.

| Part  | Fields                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| Meta  | `title`, and `direction`: `right` or `down`.                                                                           |
| Node  | `id`, `label`; optional `sub` (a second, smaller line), `shape`, `tone`, and `pos: [x, y]` on a node a person dragged. |
| Group | `id`, `label`, `wraps` (a list of node ids); optional `tone`.                                                          |
| Edge  | `from` and `to` (node ids); optional `label`, `style` (`solid`, `dashed` or `dotted`) and `tone`.                      |

A `tone` is a palette name of [`@adecore/drawing`](/drawing/documents#schemas-and-constants). Absent, a node is `rect` in `ink`, and a group and an edge are `muted` and solid. Nodes come in file order, and that order is also the starting order inside a layer of the layout.

<Demo src="canvas/diagram-shapes" />

`DIAGRAM_SHAPES` lists the five shapes in the order above.

## Checking a diagram

The schema checks shapes, not references. Run `diagramProblemIn` after every parse:

```ts
import { diagramProblemIn, migrateDiagram } from '@adecore/diagram/protocol';

const diagram = migrateDiagram(JSON.parse(file));
const problem = diagram && diagramProblemIn(diagram);
// 'The edge from "build" to "deploy" names "deploy", which is not a node'
```

`migrateDiagram` returns the parsed document or `null`. `diagramProblemIn` returns the first rule the content breaks, as a sentence that names the id, or `null`. An agent that wrote the file can repair it from that sentence. The rules, in the order it checks them:

- At most 100 nodes and 120 edges (`DIAGRAM_LIMITS`). Edges that skip many layers make a layout slow, so the limit lives here rather than in the schema.
- Node ids are unique. Groups share that namespace, so a group id is neither a node id nor another group's.
- A group wraps nodes only, never another group, and a node is in at most one group.
- Both ends of every edge are nodes.

Cycles, edges from a node to itself, several edges between the same two nodes and empty groups are all allowed. An edge has no id; its index in `edges` tells two parallel edges apart.

## Schemas

| Schema                   | Type               |
| ------------------------ | ------------------ |
| `DiagramShapeSchema`     | `DiagramShape`     |
| `DiagramDirectionSchema` | `DiagramDirection` |
| `DiagramEdgeStyleSchema` | `DiagramEdgeStyle` |
| `DiagramNodeSchema`      | `DiagramNode`      |
| `DiagramGroupSchema`     | `DiagramGroup`     |
| `DiagramEdgeSchema`      | `DiagramEdge`      |
| `DiagramMetaSchema`      | `DiagramMeta`      |
| `DiagramContentSchema`   | `DiagramContent`   |
| `DiagramDocumentSchema`  | `DiagramDocument`  |

Parsing drops keys the schemas do not know and leaves optional fields out. `DiagramEdgeStyleSchema` is the stroke style schema of the drawing package.
