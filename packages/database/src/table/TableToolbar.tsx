import type { KeyboardEvent } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Input, Separator } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';

export type FilterField = 'where' | 'orderBy';

export interface TableToolbarProps {
    refreshing: boolean;
    /* Why rows cannot be added, changed or deleted, or `null` when they can. */
    readOnlyReason: string | null;
    hasSelection: boolean;
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
    onSubmit(): void;
    onRevert(): void;
}

/* Refresh, the row actions, the submit of pending changes and the two SQL filters. */
export function TableToolbar({
    refreshing,
    readOnlyReason,
    hasSelection,
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
        </div>
    );
}
