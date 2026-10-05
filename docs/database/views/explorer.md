# DatabaseExplorer

The connections, their schemas, their tables and the columns of each table as a tree, loaded as each node opens. It is the sidebar of a database tool. It selects what a person points at, and asks the app to open it: a table, a console or the designer land wherever the app decides. See [Opening tables as tabs](/database/guide/tabs), or use [`DatabaseWorkbench`](/database/views/workbench), which does it for you.

```tsx
import { DatabaseExplorer, type ExplorerSelection } from '@adecore/database';
```

<Demo src="database/explorer" />

```tsx
const [selection, setSelection] = useState<ExplorerSelection | null>(null);

<DatabaseExplorer connections={connections} value={selection} onValueChange={setSelection} className="h-full" />;
```

An `ExplorerSelection` is the `connectionId`, plus a `schema` and a `table` when the row has them. A connection row selects with the id alone, a schema row adds the schema, and a table or a column adds the table. Look the `Connection` up by id to hand it to the other views.

The explorer needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it. What a person opens is the provider's `onAction`; the demo above shows the last action it was asked for under the tree.

## The tree

- A connection row shows its engine, a lock when it is read only, the version the server reported once it was opened, and, when system schemas are hidden, how many schemas show out of how many exist.
- A schema lists its tables under Tables and its views under Views, each folder with a count. A folder exists only when the schema has some.
- A table expands to its columns, each with its type, a key icon for a primary key column and a link icon for one that is part of a foreign key.
- A connection with one visible schema, such as a SQLite file with only `main`, shows its folders straight under it.

Nothing loads before a person asks for it. A connection opens its session when its node expands, a schema lists its tables when it expands, and a table loads its columns when it expands. A node that fails to load shows the error with a Try again row.

The tree follows the database. When something in the app changes the shape of a schema, such as the [designer](/database/views/table-designer) or a statement in a [console](/database/views/query-console) that creates, alters or drops, the client says so and the tree loads the lists that are open again. A connection whose config changed is dropped and loaded from scratch.

With `storage` on the provider, the explorer remembers which nodes are open, per connection, under `database:explorer:<connection id>`, and opens them again on the next mount. A folder is open until a person closes it, and that is remembered as well.

System schemas, such as `information_schema` and `mysql`, are hidden unless you pass `showSystemSchemas`. A filter box above the tree narrows the tables that have been loaded. It does not load more.

## Selecting and opening

A click selects a connection, a schema or a table, and a click on a connection, a schema or a folder also opens or closes it. A double click or Enter on a table, or on one of its columns, selects it and asks the app to open it with `{ kind: 'open-table', ref, view: 'data' }`.

The tree is a keyboard tree: arrow keys move, right and left expand and collapse, Home and End jump, Enter activates. One row is a tab stop.

## Context menus

Right click a row. The items of an action the app cannot take are left out: without an `onAction` on the provider there is no Open data, no New console and no Edit table. Items that write are left out on a read only connection.

| Row              | Items                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Connection       | New console, Refresh, Edit connection, Disconnect                                                    |
| Schema or folder | New table, New console here, Refresh                                                                 |
| Table or view    | Open data, Open structure, Edit table, New console here, Copy name, Copy DDL, Rename, Truncate, Drop |
| Column           | Open, Copy name                                                                                      |

- Edit table is for tables, not views. New console here starts with a `SELECT` of the table, in its schema.
- Disconnect closes the session of the connection and collapses it. The next time it opens, it connects again.
- Rename asks for a new name. Truncate asks first, and says it deletes every row. Drop asks a person to type the name of the table, and a view is dropped without touching the tables behind it. A statement that fails keeps the dialog open with the server's message.
- Edit connection asks the app to manage the connection with `manage-connection`.

## Controlled or not

Without `value` the explorer keeps the selection itself, starting at `defaultValue`. Pass `value` and `onValueChange` to keep it in the app, for example so a tab bar and the tree agree on which table is open. After a rename, or a drop, of the selected table, the selection moves to the new name, or to the schema.

## Props

| Prop                | Type                                             |                                                                    |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `connections`       | `readonly Connection[]`                          | The connections to list.                                           |
| `value`             | `ExplorerSelection \| null`                      | The selected connection, schema or table.                          |
| `defaultValue`      | `ExplorerSelection \| null`                      | Where the selection starts without `value`. `null` by default.     |
| `onValueChange`     | `(selection: ExplorerSelection \| null) => void` | The person picked a row.                                           |
| `showSystemSchemas` | `boolean`                                        | Lists the schemas the server keeps for itself. `false` by default. |
| `className`         | `string`                                         | The tree has no height of its own; this gives it one.              |
| `ref`               | `Ref<HTMLDivElement>`                            |                                                                    |

`connections` is required. `DatabaseExplorerProps`, `ExplorerSelection` and `TableRef` are exported types. There is no `onOpen`: opening is an action on the provider.
