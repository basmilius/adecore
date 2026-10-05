# StructureView

The columns, indexes, foreign keys and DDL of one table or view, in four tabs. It is read only: it shows what the server reports, and a person copies the DDL from it.

```tsx
import { StructureView } from '@adecore/database';
```

<Demo src="database/structure-view" fill />

```tsx
<StructureView connection={connection} schema="main" table="orders" className="h-full" />
```

## Tabs

- Columns lists each column with its type as declared, whether it can be null, its default as an SQL expression, extras (Auto increment and Generated) and its comment.
- Indexes lists the name, the columns and the kind: Primary, Unique, or nothing for a plain index.
- Foreign keys lists the name, the columns, the table and columns they reference, and the On update and On delete actions. An action the engine decides is shown as Default.
- DDL shows the `CREATE` statement as the server writes it, with a Copy button. A server that returns none says so.

A tab with nothing in it says that: a view has no indexes, and a table can have no foreign keys.

## Loading

The view asks the client for the structure when it mounts and again when the connection, the schema or the table changes. A spinner shows while it loads. If the request fails, a banner shows the message with a Try again button. An answer to an earlier request never replaces the current one.

## Props

| Prop | Type | |
| --- | --- | --- |
| `connection` | `Connection` | The connection the table is in. |
| `schema` | `string` | The schema of the table. |
| `table` | `string` | The table or view. |
| `className` | `string` | The view fills its parent; this sizes it. |
| `ref` | `Ref<HTMLDivElement>` | |

`connection`, `schema` and `table` are required. `StructureViewProps` is an exported type.
