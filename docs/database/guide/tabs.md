# Opening tables as tabs

The views draw no tabs or windows. When a person opens a table, a console or the designer, the view hands a `DatabaseAction` to `onAction` of the [`DatabaseProvider`](/database/guide/getting-started#databaseprovider), and the app decides where it lands.

[`DatabaseWorkbench`](/database/views/workbench) answers every action with its own tabs. This page is for apps with their own tabs.

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

`ref` is a `TableRef`: `connectionId`, `schema` and `table`. `where` is a condition as typed after `WHERE`; open the table filtered by it. `tableKind` is `'table'` or `'view'` when the sender knows it. `preview` comes only from an explorer with [`openOnClick`](/database/views/explorer#selecting-and-opening): `true` for a click, `false` for a double click or Enter. `sql` is the console's starting text, such as a `SELECT` of the right-clicked table.

Without `onAction`, the views hide the items that would send one: Open data, New console and Go to referenced row.

## A side pane and tabs

The explorer sits in a side pane, and `onAction` turns each action into a tab in the app's state:

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

- A table opened twice gets a second tab here. The workbench focuses the existing tab, except for a filtered table.
- A designer that created or renamed a table sends `edit-table`, so the app can reuse that tab instead of opening another.
- `TableView` calls `onDirtyChange` with `true` while it holds unsubmitted edits. Ask before such a tab closes, and keep background tabs mounted (`keepMounted` above), or the edits are lost.
- Give `QueryConsole` `value` and `onValueChange` to keep its text across a reload.

## What the explorer selects

`DatabaseExplorer` reports the picked row as an `ExplorerSelection`: the `connectionId`, plus a `schema` and `table` when the row has them. Use it to decide where New console runs, or to highlight the open tab's table. A click selects. A double click or Enter on a table also sends `open-table`, as does a click with `openOnClick`.

## Nested providers

`onAction` belongs to the nearest provider. A nested provider inherits every prop it leaves out from the one above: the client, `storage`, `files`, `numberNotation`, `onAction` and `onNotice`. Set only what differs.

To know which tab an action came from, wrap each tab's view in a provider with its own `onAction`. A designer that created or renamed its table then turns its own tab into that table's designer:

```tsx
<DatabaseProvider client={client} storage={storage} files={files} onAction={openTab}>
    {tabs.map((tab) => (
        <Tabs.Panel key={tab.id} value={tab.id} keepMounted>
            <DatabaseProvider onAction={(action) => openTab(action, tab.id)}>{viewOf(tab, connections)}</DatabaseProvider>
        </Tabs.Panel>
    ))}
</DatabaseProvider>
```

[`DatabaseWorkbench`](/database/views/workbench) nests one the same way. It answers the actions it can place and passes the rest up. Only the outermost provider needs a `client`; a provider with neither a client nor a parent throws.
