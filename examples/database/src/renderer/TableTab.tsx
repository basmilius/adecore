import { useTranslation } from 'react-i18next';
import { Table, TableProperties } from 'lucide-react';
import { StructureView, TableView, type Connection, type TableRef } from '@adecore/database';
import { Segmented } from '@adecore/ui';
import type { TableViewMode } from './useTabs.ts';

export interface TableTabProps {
    connection: Connection;
    tableRef: TableRef;
    view: TableViewMode;
    onViewChange(view: TableViewMode): void;
}

/* Both views stay mounted, so pending edits in the data survive a look at the structure. */
export function TableTab({ connection, tableRef, view, onViewChange }: TableTabProps) {
    const { t } = useTranslation();

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border px-3 py-2">
                <Segmented
                    label={t('tabs.views')}
                    value={view}
                    onValueChange={onViewChange}
                    options={[
                        { id: 'data', label: t('views.data'), icon: Table },
                        { id: 'structure', label: t('views.structure'), icon: TableProperties }
                    ]}
                />
                <span className="min-w-0 truncate text-xs text-text-muted">
                    {connection.name} / {tableRef.schema}.{tableRef.table}
                </span>
            </div>
            <div className="min-h-0 flex-1" hidden={view !== 'data'}>
                <TableView connection={connection} schema={tableRef.schema} table={tableRef.table} className="h-full" />
            </div>
            <div className="min-h-0 flex-1" hidden={view !== 'structure'}>
                <StructureView connection={connection} schema={tableRef.schema} table={tableRef.table} className="h-full" />
            </div>
        </div>
    );
}
