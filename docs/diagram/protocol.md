# Diagram protocol

Import schemas and inferred types from `@adecore/diagram/protocol`. It reuses drawing's palette and stroke-style schemas. The package defines graph content; the host defines document identity, transport requests and lifecycle events.

## Document fields

`DiagramContentSchema` requires `meta`, `nodes`, `groups` and `edges`. `DiagramDocumentSchema` adds `version: 1` and a nonnegative integer `rev`. `DIAGRAM_VERSION` is `1`. `EMPTY_DIAGRAM` uses an empty title, `direction: 'right'` and empty arrays. Clone this shared value before editing it.

| Shape | Required fields                                      | Optional fields                               |
| ----- | ---------------------------------------------------- | --------------------------------------------- |
| Meta  | String `title`, `direction`                          | None                                          |
| Node  | Nonempty `id`, string `label`                        | `sub`, `shape`, palette `tone`, `pos: [x, y]` |
| Group | Nonempty `id`, string `label`, `wraps` node-id array | Palette `tone`                                |
| Edge  | Nonempty node ids `from`, `to`                       | `label`, `style`, palette `tone`              |

Nodes and groups share one id namespace. Edges have no id; their stable reference within a document is their array index. Parallel edges remain distinct entries. Group arrays do not nest, and a group may be empty.

Unknown object fields are stripped. Optional fields stay absent after parsing; rendering uses rect, solid and default tones when omitted. Positions are finite numbers and may be fractional in storage; layout rounds them. The schemas impose no label-length or group-count cap.

## Graph checks are separate

`migrateDiagram(value: unknown): DiagramDocument | null` parses this one version. It does not change revisions or validate references. `DiagramDocumentSchema.parse` also checks only shape.

Call `diagramProblemIn(content)` after parsing. It returns the first named problem as a string, or `null` when valid. Checks run in this order:

1. `DIAGRAM_LIMITS`: at most 100 nodes and 120 edges.
2. Unique node ids, then group ids distinct from both nodes and prior groups.
3. Every group member names a node and appears in only one group. Repeating a member in the same group is also refused.
4. Every edge endpoint names a node.

It allows cycles, self-loops, parallel edges and empty groups. The limits are checked here, not with `.max()` on the schema arrays. No rendering helper runs this validation automatically.

## Schema and type reference

| Schema                   | Inferred type      | Values or purpose                              |
| ------------------------ | ------------------ | ---------------------------------------------- |
| `DiagramShapeSchema`     | `DiagramShape`     | `rect`, `round`, `pill`, `diamond`, `cylinder` |
| `DiagramDirectionSchema` | `DiagramDirection` | `right`, `down`                                |
| `DiagramEdgeStyleSchema` | `DiagramEdgeStyle` | Drawing's `solid`, `dashed`, `dotted`          |
| `DiagramNodeSchema`      | `DiagramNode`      | Node fields                                    |
| `DiagramGroupSchema`     | `DiagramGroup`     | Named group of nodes                           |
| `DiagramEdgeSchema`      | `DiagramEdge`      | Directed connection                            |
| `DiagramMetaSchema`      | `DiagramMeta`      | Title and direction                            |
| `DiagramContentSchema`   | `DiagramContent`   | Graph without version/revision                 |
| `DiagramDocumentSchema`  | `DiagramDocument`  | Persisted graph                                |

`DIAGRAM_SHAPES` exposes shape enum order. `DIAGRAM_VERSION`, `DIAGRAM_LIMITS`, `EMPTY_DIAGRAM`, `migrateDiagram` and `diagramProblemIn` are also protocol exports. Preserve enum order and optional-field omission in generated contracts. See [Integration and migration](./migration).
