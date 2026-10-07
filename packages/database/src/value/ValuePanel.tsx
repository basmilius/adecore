import type { Ref } from 'react';
import clsx from 'clsx';
import { MousePointerClick, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState, IconButton, PanelHeader } from '@adecore/ui';
import type { GridColumn } from '../grid/types.ts';
import type { EditValue, Value } from '../protocol/index.ts';
import { ValueEditor } from './ValueEditor.tsx';

export interface ValuePanelProps {
    /* The column of the focused cell; `null` when no cell has focus, which draws an empty state. */
    column: GridColumn | null;
    /* The whole value of the cell. `undefined` while it loads, or when it cannot be had. */
    value: Value | undefined;
    loading: boolean;
    /* Whether this cell can be changed; a read only panel still shows, formats and copies. */
    editable: boolean;
    /* The panel's draft, applied as a pending edit like an edit in the grid. */
    onCommit?(value: EditValue): void;
    onClose(): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The whole value of the focused cell beside the grid, to read and edit what a cell is too small for. */
export function ValuePanel({ column, value, loading, editable, onCommit, onClose, className, ref }: ValuePanelProps) {
    const { t } = useTranslation('database');
    const ready = column !== null && !loading && value !== undefined;

    return (
        <div ref={ref} className={clsx('flex h-full min-h-0 min-w-0 flex-col', className)}>
            <PanelHeader title={column === null ? t('value.title') : undefined}>
                {column !== null && (
                    <>
                        <span className="min-w-0 truncate text-sm font-medium text-text">{column.name}</span>
                        {column.type !== '' && <span className="min-w-0 shrink-0 truncate text-xs text-text-faint">{column.type}</span>}
                    </>
                )}
                <IconButton icon={X} size="sm" label={t('value.close')} className="ml-auto" onClick={onClose} />
            </PanelHeader>
            {ready ? (
                <ValueEditor column={column} value={value} editable={editable} onCommit={onCommit} />
            ) : (
                <div className="grid min-h-0 grow place-items-center">
                    <EmptyState icon={column === null ? MousePointerClick : undefined} busy={column !== null && loading}>
                        {column === null ? t('value.selectCell') : loading ? t('value.loading') : t('value.notLoaded')}
                    </EmptyState>
                </div>
            )}
        </div>
    );
}
