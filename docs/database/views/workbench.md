# DatabaseWorkbench

The whole database tool in one view: the explorer in a column on the left, and closable tabs beside it for the tables, consoles and designers a person opens. Use it when the database tool is a screen of its own. When the tabs belong to the app, wire the views yourself; see [Opening tables as tabs](/database/guide/tabs).

```tsx
import { DatabaseWorkbench } from '@adecore/database';
```

<Demo src="database/workbench" fill />

```tsx
<DatabaseWorkbench connections={connections} onConnectionsChange={setConnections} className="h-full" />
```

Double click a table in the explorer, right click a schema for New table or New console here, or follow a foreign key from a cell's menu: each opens a tab.

## Tabs

The workbench is a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) itself, with the client, `storage`, `files` and `numberNotation` of the one above it, and it answers the actions of the views inside.

- A table opens once; opening it again focuses its tab. A switch in the tab strip shows the data or the structure. Both stay mounted, so pending edits survive a look at the structure.
- A table opened with a condition, as a foreign key jump does, always gets a tab of its own, titled `orders (filtered)`.
- A console opens as Console 1, Console 2 and so on, on the connection and schema of the tab in front, else of the explorer's selection, else of the first connection. The button at the end of the strip opens one too.
- A designer of an existing table opens once. After a new table is created, its tab becomes the designer of that table.
- A tab closes with its button, a middle click, Delete or Backspace on the tab, or Cmd or Ctrl and W. A table tab with pending edits asks first.
- The explorer column is resized from its edge, between 200 pixels and half the window.

With `storage` on the provider, the open tabs, the tab in front, the text of each console and the data or structure switch of each table are kept under `database:workbench` and restored on the next mount. A tab whose connection is gone is dropped, but not while `connections` is empty, since the list may still be loading.

## Managing connections

With `onConnectionsChange`, the explorer's header has a button that opens a [`ConnectionManager`](/database/views/connection-manager) in a dialog, and Edit connection in the explorer opens it on that connection. Every add, edit and delete goes out through `onConnectionsChange`, and the app saves.

Without it the connections are fixed and there is no button.

## What it passes on

An action the workbench cannot place goes on to the `onAction` of the provider above it: `manage-connection` without `onConnectionsChange`, and any action for a connection that is not in `connections`.

## Props

| Prop                  | Type                                    | Default |                                                                              |
| --------------------- | --------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `connections`         | `readonly Connection[]`                 |         | Required. The connections to list.                                           |
| `onConnectionsChange` | `(next: readonly Connection[]) => void` |         | Every add, edit and delete from the manager. Without it there is no manager. |
| `className`           | `string`                                |         | Its size.                                                                    |
| `ref`                 | `Ref<HTMLDivElement>`                   |         |                                                                              |

`DatabaseWorkbenchProps` is an exported type. The workbench needs a `DatabaseProvider` above it. Its tabs are the [`Tabs`](/ui/layout/tabs) of `@adecore/ui`.
