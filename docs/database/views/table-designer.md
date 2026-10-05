# TableDesigner

Create a table or change one: its columns, indexes, foreign keys and options, with the SQL it will run shown before it runs. Nothing is sent until a person confirms.

```tsx
import { TableDesigner } from '@adecore/database';
```

<Demo src="database/table-designer" fill />

```tsx
<TableDesigner connection={connection} schema="main" table="orders" className="h-full" />
```

Leave out `table` and the designer starts a new table in `schema`. A different `table` loads that table and drops the draft. The demo's in-memory server runs no `ALTER TABLE`, so Apply shows its error there.

## The draft

The designer loads the table and the server's version, and turns them into a draft the four tabs edit. The SQL differs between SQLite and MySQL or MariaDB, and so do some fields. Each tab shows how many items the draft holds.

- Columns. A name, a type, Not null, a default and a key button that adds the column to the primary key or takes it out; MySQL and MariaDB add Auto increment and a comment. The type field suggests the types of the engine and takes any other text. The default is an SQL expression as typed: `'draft'`, `0`, `CURRENT_TIMESTAMP`. Rows move up and down. A generated column is read only and keeps its clause.
- Indexes. A name, Unique and the columns, in order. The primary key is not an index here; the key buttons on the columns set it.
- Foreign keys. A name, the columns, the referenced table, its columns (loaded when the table is picked), and On update and On delete: `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`, `SET DEFAULT` or the server's default.
- Options. Without rowid and Strict on SQLite. The storage engine, the character set, the collation and a table comment on MySQL and MariaDB, empty for the server's default.

A renamed column is renamed in the primary key, the indexes and the foreign keys too. A removed column is taken out of its indexes, and a foreign key on it is dropped.

## SQL and Apply

The panel under the tabs shows the statements for the draft, with a Copy button. A new table is one `CREATE TABLE`, with the indexes inside it on MySQL and MariaDB and as `CREATE INDEX` statements after it on SQLite. An existing table gets the fewest statements that turn it into the draft:

- MySQL and MariaDB get one `ALTER TABLE`, or two when one clause has to run before another, such as a foreign key dropped and added again under one name.
- SQLite gets `ALTER TABLE` for what its version supports (adding a column, renaming a column from 3.25, dropping one from 3.35, renaming the table) and `CREATE INDEX` or `DROP INDEX`. Any other change, such as a new type, a new primary key, a moved column or a new foreign key, rebuilds the table the way SQLite documents: foreign keys off, begin, create the new table, copy the rows, drop the old one, rename the new one, recreate the indexes, check the foreign keys, commit and foreign keys back on. The panel shows each step.

The problems of the draft are listed under the tabs: a table or a column without a name, a table without columns, a column without a type, two columns of one name, an index without a name or columns, an incomplete foreign key. Apply is disabled, with the reason on hover, while there are problems, while nothing changed, and on a read only connection or a view. Cmd or Ctrl and S does what Apply does.

Apply opens a dialog with the statements, which warns when a removed column loses its data. Confirming runs them in one `execute`. When one fails, the designer shows the server's message and keeps the draft. After a failed SQLite rebuild it rolls back the transaction it began and switches foreign keys back on. It uses the default session, so a transaction a [console](/database/views/query-console#transactions) holds open does not get in the way.

After an apply the designer loads the table again. For a new or renamed table it sends `edit-table` with the new name, so the app can follow it; see [Opening tables as tabs](/database/guide/tabs). The client announces the [schema change](/database/api/client#schema-changes), and the open explorers, structure views and table views load the new shape.

When another view changes the schema while the designer is open, an untouched draft loads again. An edited draft stays, under a banner with Reload. Revert goes back to what was loaded.

## When a table cannot be changed

The tabs and the name are disabled, and a banner says why:

| Reason                               | Message                         |
| ------------------------------------ | ------------------------------- |
| The connection has `readOnly: true`. | This connection is read only.   |
| The table is a view.                 | A view cannot be modified here. |

## Props

| Prop         | Type                  | Default |                                                                 |
| ------------ | --------------------- | ------- | --------------------------------------------------------------- |
| `connection` | `Connection`          |         | Required. The connection the table is in.                       |
| `schema`     | `string`              |         | Required. The schema of the table, or of the new table.         |
| `table`      | `string`              |         | The table to change. Without it the designer makes a new table. |
| `className`  | `string`              |         | Its size.                                                       |
| `ref`        | `Ref<HTMLDivElement>` |         |                                                                 |

`TableDesignerProps` is an exported type. The designer needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
