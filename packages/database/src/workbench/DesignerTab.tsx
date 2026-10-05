import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseAction } from '../actions.ts';
import { useDatabaseAction, useDatabaseClient, useDatabaseFiles, useDatabaseStorage } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import { TableDesigner } from '../designer/TableDesigner.tsx';
import type { WorkbenchTab } from './tabs.ts';
import { useStableCallback } from './use-stable-callback.ts';

export interface DesignerTabProps {
    connection: Connection;
    tab: Extract<WorkbenchTab, { kind: 'designer' }>;
    /* The designer saved the table under this name, so the tab is now the designer of that table. */
    onTableChange(table: string): void;
}

/* The designer answers a save with `edit-table`; in its own tab that is the same tab, not another one. Everything else goes on to the workbench. */
export function DesignerTab({ connection, tab, onTableChange }: DesignerTabProps) {
    const client = useDatabaseClient();
    const storage = useDatabaseStorage();
    const files = useDatabaseFiles();
    const outer = useDatabaseAction();

    const onAction = useStableCallback((action: DatabaseAction): void => {
        if (action.kind === 'edit-table' && action.ref.connectionId === tab.connectionId && action.ref.schema === tab.schema) {
            onTableChange(action.ref.table);
        } else {
            outer?.(action);
        }
    });

    return (
        <DatabaseProvider client={client} storage={storage} files={files} onAction={onAction}>
            <TableDesigner connection={connection} schema={tab.schema} table={tab.table} className="h-full" />
        </DatabaseProvider>
    );
}
