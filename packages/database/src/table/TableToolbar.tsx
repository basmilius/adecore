import type { Ref } from 'react';
import clsx from 'clsx';
import {
    ChevronsLeft,
    ChevronsRight,
    CopyPlus,
    Download,
    Ellipsis,
    FileInput,
    PanelRight,
    Plus,
    RefreshCw,
    Rows3,
    TableProperties,
    Trash2,
    Undo2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, IconButton, Menu } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { Engine, FileFormat } from '../protocol/index.ts';
import { CommandField } from './CommandField.tsx';
import type { Chip, CommandColumn } from './command-field.ts';
import { PAGE_SIZES, type PageBounds } from './paging.ts';

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
    engine: Engine;
    chips: readonly Chip[];
    /* The columns the command field suggests. */
    columns: readonly CommandColumn[];
    pageSize: number;
    bounds: PageBounds;
    /* The text input of the command field, for the owner to focus. */
    commandRef?: Ref<HTMLInputElement>;
    onChipsChange(next: Chip[]): void;
    onJumpToColumn(name: string): void;
    onRefresh(): void;
    onAddRow(): void;
    onDeleteRows(): void;
    onCloneRows(): void;
    onRevertRows(): void;
    onToggleValuePanel(): void;
    onToggleRecordView?(): void;
    onPageSizeChange(size: number): void;
    onFirstPage(): void;
    /* Counts the rows first when they are not counted yet. */
    onLastPage(): void;
    onSubmit(): void;
    onRevert(): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The command field for filtering, sorting and jumping to a column, refresh, add row, the submit of pending changes, and a menu of the rest. */
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
    engine,
    chips,
    columns,
    pageSize,
    bounds,
    commandRef,
    onChipsChange,
    onJumpToColumn,
    onRefresh,
    onAddRow,
    onDeleteRows,
    onCloneRows,
    onRevertRows,
    onToggleValuePanel,
    onToggleRecordView,
    onPageSizeChange,
    onFirstPage,
    onLastPage,
    onSubmit,
    onRevert,
    className,
    ref
}: TableToolbarProps) {
    const { t } = useTranslation('database');
    const readOnly = readOnlyReason !== null;
    const tooltipOf = (label: string): string => (readOnly ? t('table.unavailable', { action: label, reason: readOnlyReason }) : label);

    return (
        <div ref={ref} className={clsx('flex shrink-0 items-center gap-2 border-b border-border px-3 py-2', className)}>
            <CommandField chips={chips} columns={columns} engine={engine} inputRef={commandRef} onChipsChange={onChipsChange} onJumpToColumn={onJumpToColumn} />
            {pendingCount > 0 && (
                <>
                    <Button variant="primary" size="sm" disabled={submitting} onClick={onSubmit}>
                        {t('table.submit', { changes: formatNumber(pendingCount) })}
                    </Button>
                    <Button size="sm" disabled={submitting} onClick={onRevert}>
                        {t('table.revert')}
                    </Button>
                </>
            )}
            <IconButton icon={RefreshCw} size="sm" label={t('table.refresh')} busy={refreshing} onClick={onRefresh} />
            <IconButton
                icon={Plus}
                size="sm"
                label={t('table.addRow')}
                tooltip={tooltipOf(t('table.addRow'))}
                aria-disabled={readOnly || undefined}
                onClick={() => !readOnly && onAddRow()}
            />
            <Menu.Root>
                <IconButton icon={Ellipsis} size="sm" label={t('table.more')} render={<Menu.Trigger />} />
                <Menu.Popup align="end">
                    <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger>
                            <Icon icon={Rows3} size={14} />
                            {t('table.pageSize')}
                        </Menu.SubmenuTrigger>
                        <Menu.Popup>
                            <Menu.RadioGroup value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                                {PAGE_SIZES.map((size) => (
                                    <Menu.RadioItem key={size} value={String(size)}>
                                        {t('table.perPage', { size: formatNumber(size) })}
                                    </Menu.RadioItem>
                                ))}
                            </Menu.RadioGroup>
                        </Menu.Popup>
                    </Menu.SubmenuRoot>
                    <Menu.Item disabled={!bounds.hasPrevious} onClick={onFirstPage}>
                        <Icon icon={ChevronsLeft} size={14} />
                        {t('table.firstPage')}
                    </Menu.Item>
                    <Menu.Item disabled={!bounds.hasNext} onClick={onLastPage}>
                        <Icon icon={ChevronsRight} size={14} />
                        {t('table.lastPage')}
                        {!bounds.exact && <Menu.Hint>{t('table.lastPageCounts')}</Menu.Hint>}
                    </Menu.Item>
                    <Menu.Separator />
                    {onToggleRecordView !== undefined && (
                        <Menu.CheckboxItem checked={recordViewOpen} onCheckedChange={onToggleRecordView}>
                            <Icon icon={TableProperties} size={14} />
                            {t('table.recordView')}
                        </Menu.CheckboxItem>
                    )}
                    <Menu.CheckboxItem checked={valuePanelOpen} onCheckedChange={onToggleValuePanel}>
                        <Icon icon={PanelRight} size={14} />
                        {t('table.valuePanel')}
                    </Menu.CheckboxItem>
                    <Menu.Separator />
                    {readOnly && <Menu.Label>{readOnlyReason}</Menu.Label>}
                    <Menu.Item disabled={readOnly || !hasSelection} onClick={onCloneRows}>
                        <Icon icon={CopyPlus} size={14} />
                        {t('table.cloneRows')}
                    </Menu.Item>
                    <Menu.Item disabled={!canRevertSelection} onClick={onRevertRows}>
                        <Icon icon={Undo2} size={14} />
                        {t('table.revertRows')}
                    </Menu.Item>
                    <Menu.Item disabled={readOnly || !hasSelection} onClick={onDeleteRows}>
                        <Icon icon={Trash2} size={14} />
                        {t('table.deleteRows')}
                    </Menu.Item>
                    {transfer !== undefined && (
                        <>
                            <Menu.Separator />
                            <Menu.SubmenuRoot>
                                <Menu.SubmenuTrigger disabled={transfer.busy}>
                                    <Icon icon={Download} size={14} />
                                    {t('table.export.label')}
                                </Menu.SubmenuTrigger>
                                <Menu.Popup>
                                    {EXPORT_FORMATS.map((format) => (
                                        <Menu.Item key={format} onClick={() => transfer.onExport(format)}>
                                            {t('table.export.as', { format: format.toUpperCase() })}
                                        </Menu.Item>
                                    ))}
                                </Menu.Popup>
                            </Menu.SubmenuRoot>
                            {transfer.onImport !== undefined && (
                                <Menu.Item onClick={transfer.onImport}>
                                    <Icon icon={FileInput} size={14} />
                                    {t('table.import.menu')}
                                </Menu.Item>
                            )}
                        </>
                    )}
                </Menu.Popup>
            </Menu.Root>
        </div>
    );
}
