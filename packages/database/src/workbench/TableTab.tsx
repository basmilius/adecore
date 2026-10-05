import type { Connection } from '../client/types.ts';
import { StructureView } from '../structure/StructureView.tsx';
import { TableView } from '../table/TableView.tsx';
import type { WorkbenchTab } from './tabs.ts';

export interface TableTabProps {
    connection: Connection;
    tab: Extract<WorkbenchTab, { kind: 'table' }>;
    /* Told whether the data holds changes that are not submitted. The view that switches `tab.view` is the workbench's. */
    onDirtyChange?(dirty: boolean): void;
}

/* The data and the structure of one table, the one that `tab.view` names in front. Both stay mounted, so pending edits in the data survive a look at the structure. */
export function TableTab({ connection, tab, onDirtyChange }: TableTabProps) {
    const { schema, table } = tab.ref;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1" hidden={tab.view !== 'data'}>
                <TableView connection={connection} schema={schema} table={table} defaultWhere={tab.where} onDirtyChange={onDirtyChange} className="h-full" />
            </div>
            <div className="min-h-0 flex-1" hidden={tab.view !== 'structure'}>
                <StructureView connection={connection} schema={schema} table={table} className="h-full" />
            </div>
        </div>
    );
}
