# TableDesigner

Create a table, or change one: its columns, indexes, foreign keys and options, with the SQL that will run shown before it does. Nothing is sent until a person confirms.

```tsx
import { TableDesigner } from '@adecore/database';
```

<Demo src="database/table-designer" fill />

```tsx
<TableDesigner connection={connection} schema="main" table="orders" className="h-full" />
```

Leave out `table` and the designer starts an empty table in `schema`. The in-memory server of the demo only runs `SELECT * FROM <table>`, so Apply shows its error there; a real server runs the statements.

## The draft

The designer loads the structure of the table and the server's version, and turns them into a draft that the four tabs edit. The server's version matters: the statements for SQLite and for MySQL and MariaDB differ, and so does what the tabs offer. The strip over the tabs counts the columns, indexes and foreign keys the draft holds.

- Columns. Each row has a name, a type, Not null, a default and a key button that adds the column to the primary key or takes it out. MySQL and MariaDB add Auto increment and a comment. The type is a field with suggestions for the engine, and any other text is allowed, since both engines accept more types than a list holds. The default is an SQL expression as typed: `'draft'`, `0`, `CURRENT_TIMESTAMP`. Rows move up and down, and Add column appends one. A generated column is read only, and keeps its clause as the table's DDL had it.
- Indexes. A name, whether it is unique and the columns it covers, in order. The primary key is not an index here; it is the key buttons on the columns.
- Foreign keys. A name, the columns, the table they reference, the referenced columns (loaded when a table is picked) and the On update and On delete actions: `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`, `SET DEFAULT` or the server's default.
- Options. SQLite has Without rowid and Strict. MySQL and MariaDB have the storage engine, the character set, the collation and a table comment. Leave a field empty for the server's default.

Renaming a column carries the rename into the primary key, the indexes and the foreign keys that name it. Removing a column removes it from an index and drops a foreign key on it.

## SQL and Apply

The panel under the tabs shows the statements for the current draft, with a Copy button. A new table is one `CREATE TABLE`. MySQL and MariaDB declare the indexes inside it, and SQLite adds a `CREATE INDEX` after it for each one. A table that exists gets the fewest statements that turn it into the draft, and none when the draft changes nothing.

- MySQL and MariaDB get one `ALTER TABLE`, or two when a clause needs the other to run first, such as a column position after a rename or a foreign key dropped and added again under one name.
- SQLite gets `ALTER TABLE` statements where it has them: adding a column, renaming a column or the table, dropping a column on a version that can, and `CREATE INDEX` and `DROP INDEX`. Every other change, such as a new type, a changed primary key, a column moved or an added foreign key, is the rebuild SQLite documents: switch foreign keys off, begin, create the new table, copy the rows, drop the old one, rename the new one, recreate the indexes, check the foreign keys, commit and switch foreign keys back on. The panel shows every step.

Apply is disabled, with the reason on hover, while the draft has problems, while nothing changed, and on a read only connection or a view. The problems are listed under the tabs: a table without a name, a table without columns, a column without a name or a type, two columns with one name, an index without a name or columns, a foreign key that is not complete. Cmd or Ctrl and S opens the same confirmation.

Apply opens a dialog with the statements. A change that removes a column says that the data in it is lost. Confirming runs the statements in one `execute`. When one fails, the designer shows the server's message and keeps the draft, so the person can fix it and apply again. A failed SQLite rebuild is cleaned up: the designer rolls back the transaction it began and switches foreign keys back on, A transaction a person holds open in a console does not get in its way, since a console has a session of its own.

After a successful apply the draft is loaded again from the server. A table that was new, or that was renamed, asks the app to follow it with an `edit-table` action for the new name; see [Opening tables as tabs](/database/guide/tabs). The client tells its listeners the shape changed, so a [`DatabaseExplorer`](/database/views/explorer) loads the schema again by itself. A [`StructureView`](/database/views/structure-view) or a [`TableView`](/database/views/table-view) of the same table that is already open listens too, and loads the new shape.

The designer listens as well. When another view changes the schema while the designer is open, it loads the table again if the draft is untouched. With an edited draft it keeps the draft and shows a banner, The table changed elsewhere, with a Reload button that drops the draft and loads the table. Its own apply does not set that banner off.

Revert goes back to what was loaded.

## When a table cannot be changed

The tabs and the name are disabled, and a banner says why.

| Reason                               | Message                         |
| ------------------------------------ | ------------------------------- |
| The connection has `readOnly: true`. | This connection is read only.   |
| The table is a view.                 | A view cannot be modified here. |

## Props

| Prop         | Type                  |                                                                 |
| ------------ | --------------------- | --------------------------------------------------------------- |
| `connection` | `Connection`          | The connection the table is in.                                 |
| `schema`     | `string`              | The schema of the table, or where the new table goes.           |
| `table`      | `string`              | The table to change. Without it the designer makes a new table. |
| `className`  | `string`              | The view fills its parent; this sizes it.                       |
| `ref`        | `Ref<HTMLDivElement>` |                                                                 |

`connection` and `schema` are required. `TableDesignerProps` is an exported type. The designer needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it. A different `table` loads that table and drops the draft of the last one.
