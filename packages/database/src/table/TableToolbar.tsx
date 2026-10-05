import type { KeyboardEvent } from 'react';
import { CopyPlus, Download, FileInput, PanelRight, Plus, RefreshCw, TableProperties, Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, IconButton, Input, Menu, Separator } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { FileFormat } from '../protocol/index.ts';

export type FilterField = 'where' | 'orderBy';

/* The menu of export and import; present only when the app can show file dialogs. */
export interface TransferMenu {
    /* An export is running. */
    busy: boolean;
    onExport(format: FileFormat): void;
    /* Left out where rows cannot be added. */
    onImport?(): void;
}

const EXPORT_FORMATS: readonly FileFormat[] = ['csv', 'tsv', 'json', 'sql'];

export interface TableToolbarProps {
    refreshing: boolean;
    /* Why rows cannot be added, changed or deleted, or `null` when they can. */
    readOnlyReason: string | null;
    hasSelection: boolean;
    /* Whether any selected row has a change to take back. */
    canRevertSelection: boolean;
    valuePanelOpen: boolean;
    /* The record view replaces the grid with the focused row as a list of fields. */
    recordViewOpen?: boolean;
    transfer?: TransferMenu;
    pendingCount: number;
    submitting: boolean;
    where: string;
    orderBy: string;
    onFilterChange(field: FilterField, value: string): void;
    /* Enter in a filter. */
    onApplyFilters(): void;
    /* Escape in a filter. */
    onClearFilter(field: FilterField): void;
    onRefresh(): void;
    onAddRow(): void;
    onDeleteRows(): void;
    onCloneRows(): void;
    onRevertRows(): void;
    onToggleValuePanel(): void;
    onToggleRecordView?(): void;
    onSubmit(): void;
    onRevert(): void;
}

/* Refresh, the row actions, the submit of pending changes and the two SQL filters. */
export function TableToolbar({
    refreshing,
    readOnlyReason,
    hasSelection,
    canRevertSelection,
    valuePanelOpen,
    recordViewOpen = false,
    transfer,
    pendingCount,
    submitting,
    where,
    orderBy,
    onFilterChange,
    onApplyFilters,
    onClearFilter,
    onRefresh,
    onAddRow,
    onDeleteRows,
    onCloneRows,
    onRevertRows,
    onToggleValuePanel,
    onToggleRecordView,
    onSubmit,
    onRevert
}: TableToolbarProps) {
    const { t } = useTranslation('database');
    const tooltipOf = (label: string): string => (readOnlyReason === null ? label : t('table.unavailable', { action: label, reason: readOnlyReason }));

    const handleKeyDown = (field: FilterField) => (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) {
            return;
        }
        if (event.key === 'Enter') {
            onApplyFilters();
        } else if (event.key === 'Escape') {
            onClearFilter(field);
        }
    };

    return (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <IconButton icon={RefreshCw} size="sm" label={t('table.refresh')} busy={refreshing} onClick={onRefresh} />
            <IconButton
                icon={Plus}
                size="sm"
                label={t('table.addRow')}
                tooltip={tooltipOf(t('table.addRow'))}
                aria-disabled={readOnlyReason !== null || undefined}
                onClick={() => readOnlyReason === null && onAddRow()}
            />
            <IconButton
                icon={Trash2}
                size="sm"
                label={t('table.deleteRows')}
                tooltip={tooltipOf(t('table.deleteRows'))}
                aria-disabled={readOnlyReason !== null || !hasSelection || undefined}
                onClick={() => readOnlyReason === null && hasSelection && onDeleteRows()}
            />
            <IconButton
                icon={CopyPlus}
                size="sm"
                label={t('table.cloneRows')}
                tooltip={tooltipOf(t('table.cloneRows'))}
                aria-disabled={readOnlyReason !== null || !hasSelection || undefined}
                onClick={() => readOnlyReason === null && hasSelection && onCloneRows()}
            />
            <IconButton
                icon={Undo2}
                size="sm"
                label={t('table.revertRows')}
                aria-disabled={!canRevertSelection || undefined}
                onClick={() => canRevertSelection && onRevertRows()}
            />
            {transfer !== undefined && (
                <Menu.Root>
                    <IconButton
                        icon={Download}
                        size="sm"
                        label={t(transfer.onImport === undefined ? 'table.export.label' : 'table.export.labelWithImport')}
                        disabled={transfer.busy}
                        render={<Menu.Trigger />}
                    />
                    <Menu.Popup>
                        {EXPORT_FORMATS.map((format) => (
                            <Menu.Item key={format} onClick={() => transfer.onExport(format)}>
                                {t('table.export.as', { format: format.toUpperCase() })}
                            </Menu.Item>
                        ))}
                        {transfer.onImport !== undefined && (
                            <>
                                <Menu.Separator />
                                <Menu.Item onClick={transfer.onImport}>
                                    <Icon icon={FileInput} size={14} />
                                    {t('table.import.menu')}
                                </Menu.Item>
                            </>
                        )}
                    </Menu.Popup>
                </Menu.Root>
            )}
            {pendingCount > 0 && (
                <>
                    <Separator />
                    <Button variant="primary" size="sm" disabled={submitting} onClick={onSubmit}>
                        {t('table.submit', { changes: formatNumber(pendingCount) })}
                    </Button>
                    <Button size="sm" disabled={submitting} onClick={onRevert}>
                        {t('table.revert')}
                    </Button>
                </>
            )}
            <div className="flex min-w-64 flex-1 items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-text-faint">WHERE</span>
                    <Input
                        size="sm"
                        mono
                        value={where}
                        placeholder="id = 10"
                        spellCheck={false}
                        onChange={(event) => onFilterChange('where', event.target.value)}
                        onKeyDown={handleKeyDown('where')}
                    />
                </label>
                <label className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-text-faint">ORDER BY</span>
                    <Input
                        size="sm"
                        mono
                        value={orderBy}
                        placeholder="created_at DESC"
                        spellCheck={false}
                        onChange={(event) => onFilterChange('orderBy', event.target.value)}
                        onKeyDown={handleKeyDown('orderBy')}
                    />
                </label>
            </div>
            {onToggleRecordView !== undefined && (
                <IconButton icon={TableProperties} size="sm" label={t('table.recordView')} aria-pressed={recordViewOpen} onClick={onToggleRecordView} />
            )}
            <IconButton icon={PanelRight} size="sm" label={t('table.valuePanel')} aria-pressed={valuePanelOpen} onClick={onToggleValuePanel} />
        </div>
    );
}
