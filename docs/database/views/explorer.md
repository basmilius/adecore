# DatabaseExplorer

A tree of connections, schemas, tables and columns that loads as nodes open. It selects the picked row and asks the app to open a table, a console or the designer through the provider's `onAction`. See [Opening tables as tabs](/database/guide/tabs), or use [`DatabaseWorkbench`](/database/views/workbench), which does that for you.

```tsx
import { DatabaseExplorer, type ExplorerSelection } from '@adecore/database';
```

<Demo src="database/explorer" />

```tsx
const [selection, setSelection] = useState<ExplorerSelection | null>(null);

<DatabaseExplorer connections={connections} value={selection} onValueChange={setSelection} className="h-full" />;
```

An `ExplorerSelection` is the `connectionId`, plus the `schema` and `table` when the row has them; a column row selects its table. Without `value` the explorer keeps the selection itself, starting at `defaultValue`. After a rename or drop of the selected table, the selection follows the new name or moves to the schema.

## The tree

- A connection shows its engine, a lock when read only, the server version once connected, and how many schemas are visible when system schemas are hidden.
- A schema lists its tables under Tables and views under Views, each with a count, and only when non-empty. A connection with one visible schema, such as a SQLite file, shows the folders directly.
- A table expands to non-empty folders with counts: Columns (open from the start), Keys, Foreign keys, Indexes, Checks and Triggers. A view shows only its columns.
    - Columns show their type and key icons: yellow for a primary key, blue for a foreign key, as in the [table view](/database/views/table-view) headers.
    - Activating a foreign key opens the referenced table. Triggers show when they fire, such as `BEFORE INSERT`. SQLite tables have no Checks folder.
- Wide rows scroll sideways together, like a file tree.

Each node loads when opened. A failed node shows the error with Try again.

After a [schema change](/database/api/client#schema-changes), such as an apply in the [designer](/database/views/table-designer) or a `DROP` in a [console](/database/views/query-console), open lists reload. A connection with a changed config reloads from scratch.

System schemas, such as `information_schema` and `mysql`, are hidden unless `showSystemSchemas` is set. The filter field narrows loaded tables only. With `storage` on the provider the explorer remembers open nodes per connection.

## Selecting and opening

A click selects a row, and toggles a connection, schema or folder. A double click or Enter on a table or column sends `{ kind: 'open-table', ref, view: 'data' }`, with `tableKind` once known.

With `openOnClick`, a click on a table or view opens it with `preview: true`, and a double click or Enter sends `preview: false`. An app can open the first in a replaceable preview tab and keep the second. A click on a column or key still only selects. Without `openOnClick` no action carries `preview`.

```tsx
<DatabaseExplorer connections={connections} openOnClick className="h-full" />
```

## Folders of your own

`folders` adds the app's folders under a connection, keyed by connection id, such as files that belong to it. A folder follows the schemas with an item count, only while non-empty. It starts closed, remembers whether it is open, and shows even while the connection is connecting or failed. The filter field narrows items by label.

An `ExplorerFolder` is an `id` (unique per connection), a `label` and its `items`. An `ExplorerItem` is an `id`, a `label`, an `icon` (a Lucide icon), and two optional parts:

- `onOpen({ preview })`, called like a table opens.
- `menu`, the `ContextMenu.Item`s of its context menu.

```tsx
const folders = {
    [connection.id]: [
        {
            id: 'notes',
            label: 'Notes',
            items: notes.map((note) => ({
                id: note.path,
                label: note.name,
                icon: FileText,
                onOpen: ({ preview }) => openNote(note, preview),
                menu: <ContextMenu.Item onClick={() => deleteNote(note)}>Delete</ContextMenu.Item>
            }))
        }
    ]
};

<DatabaseExplorer connections={connections} folders={folders} className="h-full" />;
```

An item is never the selection, which stays a connection, schema or table.

The tree takes one tab stop. The arrow keys move, Right and Left expand and collapse, Home and End jump, and Enter activates.

## Context menus

| Row              | Items                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Connection       | New console, Refresh, Edit connection, Disconnect                                                       |
| Schema or folder | New table, New console here, Refresh                                                                    |
| Table or view    | Open data, Open structure, Edit table, New console here, Copy name, Copy DDL, Rename…, Truncate…, Drop… |
| Column           | Open, Copy name                                                                                         |

- Without `onAction` on the provider, the items that ask the app are hidden: open, console, New table, Edit table and Edit connection.
- A read only connection hides New table, Edit table, Rename, Truncate and Drop. A view has no Edit table, Rename or Truncate.
- New console here starts with a `SELECT` of the table, in its schema.
- Disconnect closes the connection's sessions and collapses it until reopened.
- Rename asks for the new name, Truncate asks to confirm, and Drop asks for the typed table name. On failure the dialog stays open with the server's message.
- Edit connection sends `manage-connection`.

## Props

| Prop                | Type                                             | Default |                                                       |
| ------------------- | ------------------------------------------------ | ------- | ----------------------------------------------------- |
| `connections`       | `readonly Connection[]`                          |         | Required. The connections to list.                    |
| `value`             | `ExplorerSelection \| null`                      |         | The selected row, when the app keeps it.              |
| `defaultValue`      | `ExplorerSelection \| null`                      | `null`  | Where the selection starts without `value`.           |
| `onValueChange`     | `(selection: ExplorerSelection \| null) => void` |         | The person picked a row.                              |
| `showSystemSchemas` | `boolean`                                        | `false` | Lists the schemas the server keeps for itself.        |
| `openOnClick`       | `boolean`                                        | `false` | Opens a table on a click as well, as a preview.       |
| `folders`           | `Record<string, readonly ExplorerFolder[]>`      |         | The app's own folders, by connection id.              |
| `className`         | `string`                                         |         | The tree has no height of its own; this gives it one. |
| `ref`               | `Ref<HTMLDivElement>`                            |         |                                                       |

`DatabaseExplorerProps`, `ExplorerSelection`, `ExplorerFolder` and `ExplorerItem` are exported types. The explorer needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.

## Dragging tables

`onTableDragStart(ref, event, kind)` makes table and view rows draggable. It gets the table, the React drag event and the kind (`table` or `view`); write the payload on `event.dataTransfer`. `onTableDragEnd(event)` runs after a drop or cancel, to clear drag state. A drag neither opens nor selects the table.
