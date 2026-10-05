import { useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import clsx from 'clsx';
import { ArrowUpRight, Ban, ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, copyText, EDIT_SHORTCUTS, Icon, IconButton, Input, isApplePlatform, isModHeld, Kbd, shortcut, Spinner } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { EditValue, Value } from '../protocol/index.ts';
import { cellView, copyTextOf, isPreview } from './display.ts';
import { draftOf, parseDraft } from './edit-value.ts';
import { parseEnumType } from './enum-type.ts';
import { EnumPicker } from './EnumPicker.tsx';
import type { FocusedCell, GridColumn, GridRow } from './types.ts';

export interface RecordViewProps {
    columns: readonly GridColumn[];
    rows: readonly GridRow[];
    /* The row shown, an index into `rows`. */
    index: number;
    onIndexChange(index: number): void;
    /* Lets a field be edited; the rows that are `locked` stay as they are. */
    editable?: boolean;
    onCommit?(rowKey: string, column: number, value: EditValue): void;
    /* The whole value of a field that is only a preview. Resolves `undefined` when it cannot be had. */
    loadValue?(rowKey: string, column: number): Promise<Value | undefined>;
    /* The field that holds the focus changed, or lost it. */
    onFocusedCellChange?(cell: FocusedCell | null): void;
    onFollow?(cell: FocusedCell): void;
    canFollow?(cell: FocusedCell): boolean;
    /* The accessible name of the list of fields. */
    label: string;
    /* Drawn while there are no rows. */
    empty?: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

interface Editing {
    column: number;
    draft: string;
    initial: string;
    loading: boolean;
}

const PREVIOUS_ROW = shortcut('Mod+ArrowUp');
const NEXT_ROW = shortcut('Mod+ArrowDown');

const textOf = (cell: GridRow['cells'][number], kind: GridColumn['kind']): string => {
    if (isPreview(cell)) {
        return cellView(cell, kind).text;
    }
    return cell !== null && typeof cell === 'object' && cell.kind === 'default' ? '' : draftOf(cell);
};

/*
 * One row as a list of fields, the column's name and type beside an editor for its value. Edits go
 * to the same `onCommit` the grid uses, so they pile up as pending changes there. Up and Down move
 * between the fields; with Mod they move between the rows.
 */
export function RecordView({
    columns,
    rows,
    index,
    onIndexChange,
    editable = false,
    onCommit,
    loadValue,
    onFocusedCellChange,
    onFollow,
    canFollow,
    label,
    empty,
    className,
    ref
}: RecordViewProps) {
    const { t } = useTranslation('database');
    const fields = useRef<(HTMLElement | null)[]>([]);
    const [editing, setEditing] = useState<Editing | null>(null);
    const row = rows[index];
    const enumTypes = useMemo(() => columns.map((column) => parseEnumType(column.type)), [columns]);
    const apple = isApplePlatform();

    const canEdit = (column: number): boolean =>
        editable && row !== undefined && row.locked !== true && row.state !== 'deleted' && columns[column]?.readOnly !== true;

    const commitEdit = (): void => {
        if (editing !== null && !editing.loading && row !== undefined && editing.draft !== editing.initial) {
            onCommit?.(row.key, editing.column, parseDraft(editing.draft, columns[editing.column]!.kind));
        }
        setEditing(null);
    };

    const commitValue = (column: number, value: EditValue): void => {
        if (row !== undefined && canEdit(column)) {
            onCommit?.(row.key, column, value);
        }
    };

    const beginEdit = async (column: number): Promise<void> => {
        const cell = row?.cells[column] ?? null;
        if (row === undefined || !canEdit(column) || !isPreview(cell) || loadValue === undefined) {
            return;
        }
        setEditing({ column, draft: '', initial: '', loading: true });
        const value = await loadValue(row.key, column);
        setEditing((now) => {
            if (now === null || !now.loading || now.column !== column) {
                return now;
            }
            if (value === undefined) {
                return null;
            }
            const text = draftOf(value);
            return { column, draft: text, initial: text, loading: false };
        });
    };

    const changeDraft = (column: number, draft: string): void => {
        setEditing((now) =>
            now !== null && now.column === column
                ? { ...now, draft }
                : { column, draft, initial: textOf(row?.cells[column] ?? null, columns[column]!.kind), loading: false }
        );
    };

    const focusField = (column: number): void => {
        fields.current[column]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>, column: number): void => {
        if (event.nativeEvent.isComposing) {
            return;
        }
        const mod = isModHeld(event, apple);
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const direction = event.key === 'ArrowUp' ? -1 : 1;
            if (mod) {
                commitEdit();
                onIndexChange(Math.max(0, Math.min(index + direction, rows.length - 1)));
            } else {
                focusField(Math.max(0, Math.min(column + direction, columns.length - 1)));
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            commitEdit();
        } else if (event.key === 'Escape' && editing !== null) {
            event.preventDefault();
            event.stopPropagation();
            setEditing(null);
        }
    };

    const cellOf = (column: number): FocusedCell | null => (row === undefined ? null : { rowKey: row.key, column });

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-1 flex-col bg-surface', className)}>
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
                <IconButton
                    icon={ChevronUp}
                    size="sm"
                    label={t('table.record.previous')}
                    kbd={PREVIOUS_ROW}
                    disabled={index <= 0}
                    onClick={() => onIndexChange(index - 1)}
                />
                <IconButton
                    icon={ChevronDown}
                    size="sm"
                    label={t('table.record.next')}
                    kbd={NEXT_ROW}
                    disabled={index >= rows.length - 1}
                    onClick={() => onIndexChange(index + 1)}
                />
                {row !== undefined && (
                    <>
                        <span className="text-sm font-medium text-text tabular-nums">
                            {row.number === null ? t('table.record.newRow') : t('table.record.row', { number: formatNumber(row.number) })}
                        </span>
                        <span className="text-xs text-text-faint tabular-nums">
                            {t('table.record.position', { index: formatNumber(index + 1), count: formatNumber(rows.length) })}
                        </span>
                    </>
                )}
            </div>
            {row === undefined ? (
                <p className="px-4 py-6 text-xs text-text-muted">{empty}</p>
            ) : (
                <div role="group" aria-label={label} className="min-h-0 flex-1 overflow-auto py-1">
                    {columns.map((column, position) => {
                        const cell = row.cells[position] ?? null;
                        const enumType = enumTypes[position] ?? null;
                        const active = editing !== null && editing.column === position;
                        const editableField = canEdit(position);
                        const preview = isPreview(cell);
                        const cellKey = cellOf(position);
                        const followable = cellKey !== null && onFollow !== undefined && (canFollow?.(cellKey) ?? true);
                        const nullable = column.nullable !== false;
                        const placeholder = cell === null ? 'NULL' : typeof cell === 'object' && cell.kind === 'default' ? 'DEFAULT' : undefined;
                        return (
                            <ContextMenu.Root key={position}>
                                <ContextMenu.Trigger
                                    className={clsx('flex items-center gap-3 px-4 py-1', row.edited?.has(position) && 'bg-accent/10')}
                                    onFocusCapture={() => onFocusedCellChange?.(cellKey)}
                                >
                                    <span className="flex w-56 shrink-0 items-baseline gap-2 truncate">
                                        <span className="truncate font-mono text-code text-text">{column.name}</span>
                                        {column.type !== '' && <span className="truncate text-xs text-text-faint">{column.type}</span>}
                                    </span>
                                    <span className="relative flex min-w-0 flex-1 items-center gap-1">
                                        {enumType !== null ? (
                                            <EnumPicker
                                                look="field"
                                                type={enumType}
                                                value={typeof cell === 'string' ? cell : null}
                                                nullable={nullable}
                                                label={column.name}
                                                disabled={!editableField}
                                                ref={(node) => {
                                                    fields.current[position] = node;
                                                }}
                                                onDone={(result) => {
                                                    if (result !== undefined && result.value !== (typeof cell === 'string' ? cell : null)) {
                                                        commitValue(position, result.value);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <Input
                                                size="sm"
                                                mono
                                                spellCheck={false}
                                                aria-label={column.name}
                                                ref={(node) => {
                                                    fields.current[position] = node;
                                                }}
                                                value={active ? editing.draft : textOf(cell, column.kind)}
                                                placeholder={placeholder}
                                                readOnly={!editableField || (preview && (!active || editing.loading))}
                                                className={clsx('min-w-0 flex-1', row.state === 'deleted' && 'line-through')}
                                                onFocus={() => void beginEdit(position)}
                                                onBlur={commitEdit}
                                                onChange={(event) => changeDraft(position, event.target.value)}
                                                onKeyDown={(event) => handleKeyDown(event, position)}
                                            />
                                        )}
                                        {active && editing.loading && <Spinner size={12} label={t('grid.loadingValue')} className="absolute right-2" />}
                                        {followable && (
                                            <IconButton
                                                icon={ArrowUpRight}
                                                size="xs"
                                                label={t('grid.followReference')}
                                                onClick={() => cellKey !== null && onFollow?.(cellKey)}
                                            />
                                        )}
                                    </span>
                                </ContextMenu.Trigger>
                                <ContextMenu.Popup>
                                    <ContextMenu.Item onClick={() => copyText(copyTextOf(cell))}>
                                        <Icon icon={Copy} size={14} />
                                        {t('grid.copyValue')}
                                        <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                                    </ContextMenu.Item>
                                    {editable && (
                                        <>
                                            <ContextMenu.Separator />
                                            <ContextMenu.Item disabled={!editableField || !nullable} onClick={() => commitValue(position, null)}>
                                                <Icon icon={Ban} size={14} />
                                                {t('grid.setNull')}
                                            </ContextMenu.Item>
                                            <ContextMenu.Item disabled={!editableField} onClick={() => commitValue(position, { kind: 'default' })}>
                                                <Icon icon={RotateCcw} size={14} />
                                                {t('grid.setDefault')}
                                            </ContextMenu.Item>
                                        </>
                                    )}
                                </ContextMenu.Popup>
                            </ContextMenu.Root>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
