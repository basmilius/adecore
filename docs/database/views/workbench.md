# DatabaseWorkbench

The whole database view in one piece: the explorer in a column on the left, and beside it closable tabs for the tables, consoles and designers a person opens. Use it when a database tool is a screen of its own. When the tabs belong to the app, wire the views yourself; see [Opening tables as tabs](/database/guide/tabs).

```tsx
import { DatabaseWorkbench } from '@adecore/database';
```

<Demo src="database/workbench" fill />

```tsx
<DatabaseWorkbench connections={connections} onConnectionsChange={setConnections} className="h-full" />
```

Double click a table in the explorer, right click a schema for New table or New console here, or follow a foreign key from a cell menu. Each opens a tab.

## What it does

The workbench answers the actions of the views below it. It is a [`DatabaseProvider`](/database/guide/getting-started#databaseprovider) itself, with the client, `storage` and `files` of the one above it, and it needs that one above it.

- A table opens once. Opening it again focuses its tab. The tab holds the data and the structure, and a switch in the strip chooses which is in front. Both stay mounted, so edits that were not submitted survive a look at the structure.
- A table opened with a condition, which is what following a foreign key does, always gets a tab of its own, titled `orders (filtered)`.
- A console opens in a tab named Console 1, Console 2 and so on, on the connection and the schema of the tab in front, else of the selection in the explorer, else of the first connection. The button at the end of the strip opens one, and so does New console in the explorer.
- A designer opens for a table, or for a new one. The designer of a table opens once. After it creates a table, the tab becomes the designer of that table.
- A tab closes with its button, a middle click, Delete or Backspace on the tab, and Cmd or Ctrl and W. A table tab with edits that were not submitted asks first.
- The column's width is dragged from its right edge and is at least 200 pixels, at most half of the window.

The tabs are kept. Which tabs are open, which is in front, the text of each console and whether a table shows its data or its structure go into the `storage` of the provider, under the key `database:workbench`, and come back on the next mount. The filters, sort and column layout of a table, and the history of a console, are remembered by the views themselves under their own keys. A tab whose connection is gone is dropped, but not while `connections` is empty, since it may be loading.

## Managing connections

With `onConnectionsChange` the explorer's header has a button that opens a dialog with a [`ConnectionManager`](/database/views/connection-manager), and Edit connection in an explorer menu opens it on that connection. Every add, edit and delete goes out whole through `onConnectionsChange`, and the app saves.

Without it, the connections are fixed: there is no button, and a `manage-connection` action goes on to the provider above, which may open the app's own settings.

## What it passes on

An action the workbench cannot place goes on to the `onAction` of the provider above it. That is a `manage-connection` action when there is no `onConnectionsChange`, and any action for a connection that is not in `connections`.

## Props

| Prop                  | Type                                    |                                                                      |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `connections`         | `readonly Connection[]`                 | The connections to list.                                             |
| `onConnectionsChange` | `(next: readonly Connection[]) => void` | Every add, edit and delete from the manager. Without it, no manager. |
| `className`           | `string`                                | The view fills its parent; this sizes it.                            |
| `ref`                 | `Ref<HTMLDivElement>`                   |                                                                      |

`connections` is required. `DatabaseWorkbenchProps` is an exported type. The panels are made of [`Tabs`](/ui/layout/tabs), whose tabs can be closed, and of the other views of this package.
