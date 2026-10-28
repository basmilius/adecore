# DatabaseWorkbench

The whole database tool in one view: the explorer on the left, and closable tabs for the tables, consoles and designers a person opens. Use it for a dedicated database screen. When the app owns the tabs, wire the views yourself; see [Opening tables as tabs](/database/guide/tabs).

```tsx
import { DatabaseWorkbench } from '@adecore/database';
```

<Demo src="database/workbench" fill />

```tsx
<DatabaseWorkbench connections={connections} onConnectionsChange={setConnections} className="h-full" />
```

Double clicking a table, New table or New console here on a schema, and following a foreign key each open a tab.

## Tabs

The workbench nests its own [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), inheriting the client, `storage`, `files` and `numberNotation`, and answers the actions of the views inside.

- A table opens once; opening it again focuses its tab. A switch in the tab strip toggles data and structure, both kept mounted so pending edits survive.
- A table opened with a condition, such as a foreign key jump, always gets its own tab, titled `orders (filtered)`.
- Consoles open as Console 1, Console 2 and so on, on the connection and schema of the front tab, else the explorer's selection, else the first connection. The button at the end of the strip opens one too.
- A designer of an existing table opens once. After a new table is created, its tab becomes that table's designer.
- A tab closes with its button, a middle click, Delete or Backspace, or Cmd or Ctrl+W. A table tab with pending edits asks first.
- The explorer column resizes from its edge, between 200 pixels and half the window.

With `storage` on the provider, the open tabs, the front tab, console text and each table's data or structure switch are kept under `database:workbench`. Tabs of missing connections are dropped, except while `connections` is empty and may still be loading.

## Managing connections

With `onConnectionsChange`, a button in the explorer header opens a [`ConnectionManager`](/database/views/connection-manager) in a dialog, as does Edit connection. Every change goes out through `onConnectionsChange` for the app to save. Without it the connections are fixed.

## What it passes on

Actions the workbench cannot place go to `onAction` of the provider above: `manage-connection` without `onConnectionsChange`, and any action for a connection not in `connections`.

## Props

| Prop                  | Type                                    | Default |                                                                              |
| --------------------- | --------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `connections`         | `readonly Connection[]`                 |         | Required. The connections to list.                                           |
| `onConnectionsChange` | `(next: readonly Connection[]) => void` |         | Every add, edit and delete from the manager. Without it there is no manager. |
| `className`           | `string`                                |         | Its size.                                                                    |
| `ref`                 | `Ref<HTMLDivElement>`                   |         |                                                                              |

`DatabaseWorkbenchProps` is an exported type. The workbench needs a `DatabaseProvider` above it. Its tabs are the [`Tabs`](/ui/layout/tabs) of `@adecore/ui`.
