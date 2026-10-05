# Opening tables as tabs

The views draw no tabs and no windows. A table, a console or the designer opens where the app decides: in a tab beside its file tabs, in a split, in a window of its own. The views only ask. They hand a `DatabaseAction` to the `onAction` of the [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), and the app answers it.

If you want the answer written for you, [`DatabaseWorkbench`](/database/views/workbench) is an explorer beside closable tabs, and it handles every action itself. Read on when the tabs belong to the app.

```tsx
import type { DatabaseAction, ExplorerSelection } from '@adecore/database';
```

## The actions

| `kind`              | Fields                                          | Asked by                                                                |
| ------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `open-table`        | `ref`, `view` (`data` or `structure`), `where?` | The explorer, and a jump along a foreign key in the table view          |
| `open-console`      | `connectionId`, `schema?`, `sql?`               | The explorer's New console items                                        |
| `new-table`         | `connectionId`, `schema`                        | The explorer's New table item on a schema                               |
| `edit-table`        | `ref`                                           | The explorer's Edit table item, and the designer after it saved a table |
| `manage-connection` | `connectionId`                                  | The explorer's Edit connection item                                     |

`ref` is a `TableRef`: `connectionId`, `schema` and `table`. `where` on `open-table` is a condition as a person types it after `WHERE`. The table view sends it when a person follows a foreign key, and it expects the table to open filtered to the row that was referenced. `sql` on `open-console` is the text the new console starts with, such as a `SELECT` for the table that was right clicked.

A view that has no `onAction` to call leaves out the items that would go nowhere. The explorer shows no Open data without one, and the table view shows no Go to referenced row.

## A side pane and tabs

This is an app with the explorer in a side pane and everything it opens as tabs in the strip it already has. The tabs are the app's own state, and `onAction` turns an action into a tab.

```tsx
import { useState } from 'react';
import { Tabs } from '@adecore/ui';
import {
    DatabaseExplorer,
    DatabaseProvider,
    type DatabaseClient,
    QueryConsole,
    StructureView,
    TableDesigner,
    TableView,
    type Connection,
    type DatabaseAction,
    type ExplorerSelection,
    type TableRef
} from '@adecore/database';

type Tab =
    | { id: string; kind: 'table'; ref: TableRef; view: 'data' | 'structure'; where?: string }
    | { id: string; kind: 'console'; connectionId: string; schema?: string; sql: string }
    | { id: string; kind: 'design'; connectionId: string; schema: string; table?: string };

const tabOf = (action: DatabaseAction): Tab | null => {
    const id = crypto.randomUUID();

    switch (action.kind) {
        case 'open-table':
            return { id, kind: 'table', ref: action.ref, view: action.view, where: action.where };
        case 'open-console':
            return { id, kind: 'console', connectionId: action.connectionId, schema: action.schema, sql: action.sql ?? '' };
        case 'new-table':
            return { id, kind: 'design', connectionId: action.connectionId, schema: action.schema };
        case 'edit-table':
            return { id, kind: 'design', connectionId: action.ref.connectionId, schema: action.ref.schema, table: action.ref.table };
        case 'manage-connection':
            return null;
    }
};

export function DatabasePane({ client, connections }: { client: DatabaseClient; connections: readonly Connection[] }) {
    const [tabs, setTabs] = useState<readonly Tab[]>([]);
    const [picked, setPicked] = useState<string | null>(null);
    const [selection, setSelection] = useState<ExplorerSelection | null>(null);

    function onAction(action: DatabaseAction): void {
        if (action.kind === 'manage-connection') {
            openSettings(action.connectionId);
            return;
        }

        const tab = tabOf(action);
        if (tab !== null) {
            setTabs((current) => [...current, tab]);
            setPicked(tab.id);
        }
    }

    return (
        <DatabaseProvider client={client} onAction={onAction}>
            <div className="flex h-full">
                <DatabaseExplorer connections={connections} value={selection} onValueChange={setSelection} className="w-72 border-r border-border" />
                <Tabs.Root value={picked} onValueChange={(id) => setPicked(String(id))} className="flex min-w-0 flex-1 flex-col">
                    <Tabs.List aria-label="Open databases">
                        {tabs.map((tab) => (
                            <Tabs.Tab key={tab.id} value={tab.id} onClose={() => setTabs(tabs.filter((other) => other.id !== tab.id))}>
                                {titleOf(tab)}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                    {tabs.map((tab) => (
                        <Tabs.Panel key={tab.id} value={tab.id} keepMounted className="min-h-0 flex-1">
                            {viewOf(tab, connections)}
                        </Tabs.Panel>
                    ))}
                </Tabs.Root>
            </div>
        </DatabaseProvider>
    );
}
```

`viewOf` picks the view for a tab from the connection with the id the tab names:

```tsx
function viewOf(tab: Tab, connections: readonly Connection[]) {
    const connection = connections.find((entry) => entry.id === (tab.kind === 'table' ? tab.ref.connectionId : tab.connectionId));

    if (connection === undefined) {
        return null;
    }

    switch (tab.kind) {
        case 'table':
            return tab.view === 'data' ? (
                <TableView connection={connection} schema={tab.ref.schema} table={tab.ref.table} defaultWhere={tab.where} className="h-full" />
            ) : (
                <StructureView connection={connection} schema={tab.ref.schema} table={tab.ref.table} className="h-full" />
            );
        case 'console':
            return <QueryConsole connection={connection} schema={tab.schema} defaultValue={tab.sql} className="h-full" />;
        case 'design':
            return <TableDesigner connection={connection} schema={tab.schema} table={tab.table} className="h-full" />;
    }
}
```

Some details the example leaves to you, each a decision about your tabs:

- A table opened twice. The example opens a second tab. A workbench opens a table once and focuses the tab it has, except for a filtered one, which is always a tab of its own because the filter is what the person asked to see.
- A designer that saves a new table. It sends `edit-table` for the table it made, so the app can turn the tab into the designer of that table instead of opening another.
- Unsaved edits. `TableView` takes `onDirtyChange`, called with `true` when the view holds edits that were not submitted and `false` when it holds none. Use it to ask before a tab with edits closes. Keep the view mounted while its tab is in the background (`keepMounted` above), or the edits go with it.
- A console that survives a reload. Give `QueryConsole` `value` and `onValueChange` and keep the text in the tab. The history of a console is kept through `storage`; see [Getting started](/database/guide/getting-started#databaseprovider).

## What the explorer selects

`DatabaseExplorer` selects a connection, a schema or a table, and reports it as an `ExplorerSelection`: the `connectionId`, and a `schema` and a `table` when the row has them. Use the selection to decide what New console should be connected to when no tab is in front, or to highlight the table whose tab is open. Selecting is separate from opening: a click selects, and a double click or Enter on a table selects it and then asks for `open-table`.

## Nested providers

`onAction` belongs to one provider, and a provider can be placed inside another to answer for a part of the page. [`DatabaseWorkbench`](/database/views/workbench) does this: it answers the actions it can place itself, and hands the ones it cannot, such as `manage-connection` without `onConnectionsChange`, to the provider above it.
