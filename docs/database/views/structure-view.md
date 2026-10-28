# StructureView

The columns, indexes, foreign keys and DDL of one table or view, in four read only tabs. To change a table, use [`TableDesigner`](/database/views/table-designer).

```tsx
import { StructureView } from '@adecore/database';
```

<Demo src="database/structure-view" fill />

```tsx
<StructureView connection={connection} schema="main" table="orders" className="h-full" />
```

- Columns lists the declared type, nullability, default, Auto increment or Generated, and comment.
- Indexes lists the name, columns and kind: Primary, Unique, or blank.
- Foreign keys lists the name, columns, referenced table and columns, and On update and On delete. An engine-decided action reads Default.
- DDL shows the server's `CREATE` statement, with a Copy button.

`toolbarStart` draws the app's content before the tabs, as in [`TableView`](/database/views/table-view#your-own-content-in-the-toolbar).

The view reloads when its props change and after a [schema change](/database/api/client#schema-changes) for its schema, keeping the old structure until the new one arrives. A failed load shows the message with Try again.

## Props

| Prop           | Type                  | Default |                                           |
| -------------- | --------------------- | ------- | ----------------------------------------- |
| `connection`   | `Connection`          |         | Required. The connection the table is in. |
| `schema`       | `string`              |         | Required. The schema of the table.        |
| `table`        | `string`              |         | Required. The table or view.              |
| `toolbarStart` | `ReactNode`           |         | The app's own content before the tabs.    |
| `className`    | `string`              |         | Its size.                                 |
| `ref`          | `Ref<HTMLDivElement>` |         |                                           |

`StructureViewProps` is an exported type. The view needs a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) above it.
