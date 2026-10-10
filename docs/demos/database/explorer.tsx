import { useState } from 'react';
import { DatabaseExplorer, type DatabaseAction, type ExplorerSelection } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP_CONNECTIONS } from '../shared/shop.ts';

/* What the app was asked to do, in words. */
function describe(action: DatabaseAction): string {
    switch (action.kind) {
        case 'open-table':
            return `Open ${action.ref.schema}.${action.ref.table} as ${action.view}.`;
        case 'open-console':
            return action.sql === undefined ? 'Open a console.' : `Open a console with ${action.sql}`;
        case 'new-table':
            return `Design a new table in ${action.schema}.`;
        case 'edit-table':
            return `Design ${action.ref.schema}.${action.ref.table}.`;
        case 'manage-connection':
            return `Edit the connection ${action.connectionId}.`;
    }
}

export default function ExplorerDemo() {
    const [selection, setSelection] = useState<ExplorerSelection | null>(null);
    const [action, setAction] = useState<DatabaseAction | null>(null);

    return (
        <ShopDatabase onAction={setAction}>
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface">
                <DatabaseExplorer connections={SHOP_CONNECTIONS} value={selection} onValueChange={setSelection} className="h-72" />
                <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
                    {action === null ? 'Double click a table, or right click anything.' : describe(action)}
                </p>
            </div>
        </ShopDatabase>
    );
}
