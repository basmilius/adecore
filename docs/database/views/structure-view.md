# StructureView

The columns, indexes, foreign keys and DDL of one table or view, in four tabs. It only reads: it shows what the server reports, and a person copies the DDL from it. To change a table, use [`TableDesigner`](/database/views/table-designer).

```tsx
import { StructureView } from '@adecore/database';
```

<Demo src="database/structure-view" fill />

```tsx
<StructureView connection={connection} schema="main" table="orders" className="h-full" />
```

- Columns lists each column with its type as declared, whether it is nullable, its default as an SQL expression, Auto increment or Generated, and its comment.
- Indexes lists the name, the columns and the kind: Primary, Unique, or nothing for a plain index.
- Foreign keys lists the name, the columns, the table and columns they reference, and the On update and On delete actions. An action the engine decides reads Default.
- DDL shows the `CREATE` statement as the server writes it, with a Copy button.

A tab with nothing to show says so. The view loads again when the connection, the schema or the table changes. After a [schema change](/database/api/client#schema-changes) for its schema it loads again too, and keeps the old structure on screen until the new one arrives. A failed load shows the message with Try again.

## Props

| Prop         | Type                  | Default |                                           |
| ------------ | --------------------- | ------- | ----------------------------------------- |
| `connection` | `Connection`          |         | Required. The connection the table is in. |
| `schema`     | `string`              |         | Required. The schema of the table.        |
| `table`      | `string`              |         | Required. The table or view.              |
| `className`  | `string`              |         | Its size.                                 |
| `ref`        | `Ref<HTMLDivElement>` |         |                                           |

`StructureViewProps` is an exported type. The view needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
