import { StructureView, TableView, type Connection, type TableRef } from '@adecore/database';
import type { TableViewMode } from './useTabs.ts';

export interface TableTabProps {
    connection: Connection;
    tableRef: TableRef;
    view: TableViewMode;
    /* The filter the table opens with. */
    where?: string;
    /* Told whether the data holds changes that are not submitted. */
    onDirtyChange(dirty: boolean): void;
}

/* Both views stay mounted, so pending edits in the data survive a look at the structure. */
export function TableTab({ connection, tableRef, view, where, onDirtyChange }: TableTabProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1" hidden={view !== 'data'}>
                <TableView
                    connection={connection}
                    schema={tableRef.schema}
                    table={tableRef.table}
                    defaultWhere={where}
                    onDirtyChange={onDirtyChange}
                    className="h-full"
                />
            </div>
            <div className="min-h-0 flex-1" hidden={view !== 'structure'}>
                <StructureView connection={connection} schema={tableRef.schema} table={tableRef.table} className="h-full" />
            </div>
        </div>
    );
}
