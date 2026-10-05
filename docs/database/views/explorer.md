# DatabaseExplorer

The connections, their schemas and their tables as a tree, loaded as each node opens. It is the sidebar of a database tool: pick a table in it and show a [`TableView`](/database/views/table-view) or a [`StructureView`](/database/views/structure-view) beside it.

```tsx
import { DatabaseExplorer, type TableRef } from '@adecore/database';
```

<Demo src="database/explorer" />

```tsx
const [table, setTable] = useState<TableRef | null>(null);

<DatabaseExplorer connections={connections} value={table} onValueChange={setTable} onOpen={openTab} className="h-full" />
```

A `TableRef` names a table: the `connectionId`, the `schema` and the `table`. Look the `Connection` up by id to hand it to the other views.

## Behavior

- A connection opens its session when its node expands, and a schema lists its tables when it expands. Nothing loads before a person asks for it. A node that fails to load shows the error with a Try again row.
- A connection with one visible schema, such as a SQLite file with only `main`, shows its tables straight under it.
- A filter box above the tree narrows the tables that have been loaded. It does not load more.
- System schemas (such as `information_schema` and `mysql`) are hidden unless you pass `showSystemSchemas`. Views are listed beside tables, with their own icon.
- A click on a table selects it. A double click or Enter on a table, or Open in its menu, calls `onOpen`.
- The right-click menu of a connection has Refresh and Disconnect, a schema has Refresh, and a table has Open and Copy name.
- The tree is a keyboard tree: arrow keys move, right and left expand and collapse, Home and End jump, Enter activates. One row is a tab stop.

## Controlled or not

Without `value` the explorer keeps the selection itself, starting at `defaultValue`. Pass `value` and `onValueChange` to keep it in the app, for example so a tab bar and the tree agree on which table is open.

## Props

| Prop | Type | |
| --- | --- | --- |
| `connections` | `readonly Connection[]` | The connections to list. |
| `value` | `TableRef \| null` | The selected table. |
| `defaultValue` | `TableRef \| null` | Where the selection starts without `value`. `null` by default. |
| `onValueChange` | `(ref: TableRef \| null) => void` | The person picked a table. |
| `onOpen` | `(ref: TableRef) => void` | A double click or Enter on a table, or Open in its menu. |
| `showSystemSchemas` | `boolean` | Lists the schemas the server keeps for itself. `false` by default. |
| `className` | `string` | The tree has no height of its own; this gives it one. |
| `ref` | `Ref<HTMLDivElement>` | |

`connections` is required. `DatabaseExplorerProps` and `TableRef` are exported types.
