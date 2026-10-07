# Opening tables as tabs

The views draw no tabs and no windows. When a person opens a table, a console or the designer, the view hands a `DatabaseAction` to the `onAction` of the [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), and the app decides where it lands: a tab beside its file tabs, a split, a window of its own.

[`DatabaseWorkbench`](/database/views/workbench) answers every action with tabs of its own. Read on when the tabs belong to the app.

```tsx
import type { DatabaseAction, ExplorerSelection } from '@adecore/database';
```

## The actions

| `kind`              | Fields                                                                        | Sent by                                                                              |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `open-table`        | `ref`, `view` (`'data'` or `'structure'`), `where?`, `tableKind?`, `preview?` | The explorer, and a jump along a foreign key in the table view                       |
| `open-console`      | `connectionId`, `schema?`, `sql?`                                             | The explorer's New console items                                                     |
| `new-table`         | `connectionId`, `schema`                                                      | The explorer's New table item                                                        |
| `edit-table`        | `ref`                                                                         | The explorer's Edit table item, and the designer after it created or renamed a table |
| `manage-connection` | `connectionId`                                                                | The explorer's Edit connection item                                                  |

`ref` is a `TableRef`: `connectionId`, `schema` and `table`. `where` is a condition as typed after `WHERE`, and the table should open filtered by it. `tableKind` says whether `ref` is a `'table'` or a `'view'`, where the sender knows it; the explorer does once the schema's list has loaded. `preview` comes only from an explorer with [`openOnClick`](/database/views/explorer#selecting-and-opening): `true` for a click, `false` for a double click or Enter. `sql` is the text a new console starts with, such as a `SELECT` of the table that was right clicked.

Without `onAction`, the views leave out the items that would send one: the explorer has no Open data and no New console, and the table view has no Go to referenced row.

## A side pane and tabs

The explorer sits in a side pane, and `onAction` turns each action into a tab in the app's own state:

```tsx
import { useState } from 'react';
import { Tabs } from '@adecore/ui';
import {
    DatabaseExplorer,
    DatabaseProvider,
    QueryConsole,
    StructureView,
    TableDesigner,
    TableView,
    type Connection,
    type DatabaseAction,
    type DatabaseClient,
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

The example leaves these decisions to you:

- A table opened twice gets a second tab here. The workbench focuses the tab it has, except for a filtered table, which always gets a tab of its own.
- A designer that created or renamed a table sends `edit-table` for it, so the app can turn that tab into the designer of the table instead of opening another.
- `TableView` calls `onDirtyChange` with `true` while it holds edits that were not submitted. Use it to ask before such a tab closes, and keep background tabs mounted (`keepMounted` above), or the edits go with them.
- Give `QueryConsole` `value` and `onValueChange` to keep its text in the tab, so it survives a reload.

## What the explorer selects

`DatabaseExplorer` reports the row a person picked as an `ExplorerSelection`: the `connectionId`, and a `schema` and a `table` when the row has them. Use it to decide where New console runs when no tab is in front, or to highlight the table of the open tab. A click selects; a double click or Enter on a table also sends `open-table`, and with `openOnClick` a click on a table does too.

## Nested providers

`onAction` belongs to the nearest provider, so a provider inside another answers for a part of the page. A provider inside another takes every prop it leaves out from the one above it: the client, `storage`, `files`, `numberNotation`, `onAction` and `onNotice` too. Set only what differs for that part.

To know which tab an action came from, wrap the view of each tab in a provider with an `onAction` of its own. A designer that created or renamed its table then turns its own tab into the designer of that table:

```tsx
<DatabaseProvider client={client} storage={storage} files={files} onAction={openTab}>
    {tabs.map((tab) => (
        <Tabs.Panel key={tab.id} value={tab.id} keepMounted>
            <DatabaseProvider onAction={(action) => openTab(action, tab.id)}>{viewOf(tab, connections)}</DatabaseProvider>
        </Tabs.Panel>
    ))}
</DatabaseProvider>
```

[`DatabaseWorkbench`](/database/views/workbench) nests one the same way: it answers the actions it can place, and passes the rest to the provider above it. Only the outermost provider needs a `client`; one without a client and without a provider above it throws.
