# TableDesigner

Create or change a table's columns, indexes, foreign keys and options. The designer shows the SQL first and sends nothing until a person confirms.

```tsx
import { TableDesigner } from '@adecore/database';
```

<Demo src="database/table-designer" fill />

```tsx
<TableDesigner connection={connection} schema="main" table="orders" className="h-full" />
```

Without `table`, the designer starts a new table in `schema`. A new `table` loads that table and drops the draft. The demo server runs no `ALTER TABLE`, so Apply shows an error.

`toolbarStart` draws the app's content before the table name, as in [`TableView`](/database/views/table-view#your-own-content-in-the-toolbar).

## The draft

Four tabs edit a draft of the table, each with an item count. Some fields depend on the engine.

- Columns. A name, a type, Not null, a default and a primary key toggle; MySQL and MariaDB add Auto increment and a comment. The type field suggests the engine's types and takes any text. The default is an SQL expression as typed: `'draft'`, `0`, `CURRENT_TIMESTAMP`. Rows reorder. A generated column is read only and keeps its clause.
- Indexes. A name, Unique and ordered columns. The column key toggles set the primary key.
- Foreign keys. A name, the columns, the referenced table and its columns, and On update and On delete: `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`, `SET DEFAULT` or the server's default.
- Options. Without rowid and Strict on SQLite. Storage engine, character set, collation and table comment on MySQL and MariaDB, empty for the server's default.

Renaming a column renames it in keys, indexes and foreign keys. Removing one takes it out of its indexes and drops its foreign keys.

## SQL and Apply

The panel under the tabs shows the draft's statements, with a Copy button. A new table is one `CREATE TABLE`, plus `CREATE INDEX` statements on SQLite. An existing table gets the fewest statements:

- MySQL and MariaDB get one `ALTER TABLE`, or two when clauses must run in order, such as a foreign key dropped and re-added under one name.
- SQLite gets `ALTER TABLE` where its version supports it (adding a column, renaming a column from 3.25, dropping one from 3.35, renaming the table) and `CREATE INDEX` or `DROP INDEX`. Any other change, such as a new type, primary key, column order or foreign key, rebuilds the table as SQLite documents, step by step in the panel.

Draft problems are listed under the tabs, such as a missing name or type, duplicate columns or an incomplete foreign key. Apply is disabled, with the reason on hover, while there are problems or no changes, and on a read only connection or a view. Cmd or Ctrl+S applies.

Apply opens a dialog with the statements and warns when a removed column loses data. Confirming runs them in one `execute`. On failure the designer shows the server's message and keeps the draft; a failed SQLite rebuild rolls back. It uses the default session, outside any [console](/database/views/query-console#transactions) transaction.

After an apply the designer reloads the table. For a new or renamed table it sends `edit-table` with the new name; see [Opening tables as tabs](/database/guide/tabs). The client announces the [schema change](/database/api/client#schema-changes), so open views reload.

When another view changes the schema, an untouched draft reloads. An edited draft stays, under a banner with Reload. Revert returns to the loaded table.

## When a table cannot be changed

The tabs and the name are disabled, and a banner says why:

| Reason                               | Message                         |
| ------------------------------------ | ------------------------------- |
| The connection has `readOnly: true`. | This connection is read only.   |
| The table is a view.                 | A view cannot be modified here. |

## Props

| Prop           | Type                  | Default |                                                                 |
| -------------- | --------------------- | ------- | --------------------------------------------------------------- |
| `connection`   | `Connection`          |         | Required. The connection the table is in.                       |
| `schema`       | `string`              |         | Required. The schema of the table, or of the new table.         |
| `table`        | `string`              |         | The table to change. Without it the designer makes a new table. |
| `toolbarStart` | `ReactNode`           |         | The app's own content at the start of the toolbar.              |
| `className`    | `string`              |         | Its size.                                                       |
| `ref`          | `Ref<HTMLDivElement>` |         |                                                                 |

`TableDesignerProps` is an exported type. The designer needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
