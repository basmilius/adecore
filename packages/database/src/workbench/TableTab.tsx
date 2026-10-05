import { Table, TableProperties } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Segmented } from '@adecore/ui';
import type { Connection } from '../client/types.ts';
import { StructureView } from '../structure/StructureView.tsx';
import { TableView } from '../table/TableView.tsx';
import type { TableViewMode, WorkbenchTab } from './tabs.ts';

export interface TableTabProps {
    connection: Connection;
    tab: Extract<WorkbenchTab, { kind: 'table' }>;
    onViewChange(view: TableViewMode): void;
}

/* The data and the structure of one table behind a switch. Both stay mounted, so pending edits in the data survive a look at the structure. */
export function TableTab({ connection, tab, onViewChange }: TableTabProps) {
    const { t } = useTranslation('database');
    const { schema, table } = tab.ref;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
                <Segmented
                    label={t('workbench.views')}
                    value={tab.view}
                    onValueChange={onViewChange}
                    options={[
                        { id: 'data', label: t('workbench.data'), icon: Table },
                        { id: 'structure', label: t('workbench.structure'), icon: TableProperties }
                    ]}
                />
                <span className="min-w-0 truncate text-xs text-text-muted">
                    {connection.name} / {schema}.{table}
                </span>
            </div>
            <div className="min-h-0 flex-1" hidden={tab.view !== 'data'}>
                <TableView connection={connection} schema={schema} table={table} defaultWhere={tab.where} className="h-full" />
            </div>
            <div className="min-h-0 flex-1" hidden={tab.view !== 'structure'}>
                <StructureView connection={connection} schema={schema} table={table} className="h-full" />
            </div>
        </div>
    );
}
