import { useCallback, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { Ban, Copy, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, copyText, EDIT_SHORTCUTS, Icon, isApplePlatform, isModHeld, Kbd, Spinner, useContentSize } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { EditValue, Value } from '../protocol/index.ts';
import { CellEditor, type EditMove } from './CellEditor.tsx';
import { cellView, copyTextOf, isPreview, type CellView } from './display.ts';
import { draftOf, parseDraft } from './edit-value.ts';
import { GridHeaderCell } from './GridHeaderCell.tsx';
import {
    clampColumnWidth,
    columnOffsets,
    estimateColumnWidth,
    FALLBACK_VIEWPORT_HEIGHT,
    gutterWidth,
    HEADER_HEIGHT,
    OVERSCAN_ROWS,
    ROW_HEIGHT,
    scrollToReveal,
    visibleRange
} from './layout.ts';
import { moveFocus, type CellPosition } from './navigation.ts';
import { selectRow } from './row-selection.ts';
import type { GridColumn, GridRow } from './types.ts';

export interface DataGridProps {
    columns: readonly GridColumn[];
    rows: readonly GridRow[];
    /* The accessible name of the grid. */
    label: string;
    /* Lets a cell be edited in place; the rows that are `locked` stay as they are. */
    editable?: boolean;
    /* The selected rows by key. Without it the grid keeps the selection itself. */
    selectedKeys?: ReadonlySet<string>;
    onSelectedKeysChange?(keys: ReadonlySet<string>): void;
    /* A cell was edited, or set to NULL or DEFAULT from its menu. */
    onCommit?(rowKey: string, column: number, value: EditValue): void;
    /* The whole value of a cell that is only a preview, which editing needs. Resolves `undefined` when it cannot be had, which cancels the edit. */
    loadValue?(rowKey: string, column: number): Promise<Value | undefined>;
    /* Drawn under the header while there are no rows. */
    empty?: ReactNode;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

interface Editing extends CellPosition {
    draft: string;
    initial: string;
    loading: boolean;
}

interface Sizing {
    columns: readonly GridColumn[];
    hasRows: boolean;
    estimated: readonly number[];
    resized: Readonly<Record<number, number>>;
}

const NO_KEYS: ReadonlySet<string> = new Set();

const estimateWidths = (columns: readonly GridColumn[], rows: readonly GridRow[]): number[] =>
    columns.map((column, index) =>
        estimateColumnWidth(
            column.name,
            rows.slice(0, 50).map((row) => {
                const view = cellView(row.cells[index] ?? null, column.kind);
                return view.suffix === undefined ? view.text : `${view.text} ${view.suffix}`;
            }),
            column.primaryKey === true
        )
    );

const TONE: Record<CellView['tone'], string> = {
    value: '',
    null: 'text-text-faint',
    default: 'text-text-faint italic'
};

const ROW_STATE = {
    inserted: 'bg-positive/10',
    deleted: 'bg-status-error/10 text-text-faint'
} as const;

/*
 * The table of the table view and of the console. Only the rows in view are drawn, at a fixed
 * height, inside a box as tall as all of them; the header and the row-number gutter stick to the edges
 * of the scroll box. Focus stays on that box and points at the cell with `aria-activedescendant`, so
 * a cell scrolled out of the window loses nothing.
 */
export function DataGrid({
    columns,
    rows,
    label,
    editable = false,
    selectedKeys,
    onSelectedKeysChange,
    onCommit,
    loadValue,
    empty,
    className,
    ref
}: DataGridProps) {
    const { t } = useTranslation('database');
    const gridId = useId();
    const scroller = useRef<HTMLDivElement | null>(null);
    const anchor = useRef(-1);
    /* Set once an edit commits or cancels, so the blur that follows the input's removal does not commit it again. */
    const settled = useRef(true);
    const [measure, size] = useContentSize();
    const [scrollTop, setScrollTop] = useState(0);
    const [focused, setFocused] = useState<CellPosition | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [ownSelection, setOwnSelection] = useState<ReadonlySet<string>>(NO_KEYS);
    const [sizing, setSizing] = useState<Sizing>(() => ({ columns, hasRows: rows.length > 0, estimated: estimateWidths(columns, rows), resized: {} }));

    let current = sizing;
    if (sizing.columns !== columns || sizing.hasRows !== rows.length > 0) {
        current = { columns, hasRows: rows.length > 0, estimated: estimateWidths(columns, rows), resized: {} };
        setSizing(current);
    }

    const widths = columns.map((_, index) => current.resized[index] ?? current.estimated[index] ?? clampColumnWidth(0));
    const offsets = columnOffsets(widths);
    const gutter = gutterWidth(rows.length);
    const totalWidth = gutter + widths.reduce((sum, width) => sum + width, 0);
    const viewportHeight = size.height > 0 ? size.height : FALLBACK_VIEWPORT_HEIGHT;
    const range = visibleRange(scrollTop - HEADER_HEIGHT, viewportHeight, ROW_HEIGHT, rows.length, OVERSCAN_ROWS);
    const selection = selectedKeys ?? ownSelection;
    const focusCell = focused !== null && focused.row < rows.length && focused.column < columns.length ? focused : null;
    const page = Math.max(1, Math.floor((viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT));

    const attach = useCallback(
        (node: HTMLDivElement | null) => {
            scroller.current = node;
            measure(node);
            if (typeof ref === 'function') {
                ref(node);
            } else if (ref) {
                ref.current = node;
            }
        },
        [measure, ref]
    );

    const cellId = (row: number, column: number): string => `${gridId}-${row}-${column}`;

    const canEdit = (position: CellPosition): boolean => {
        const row = rows[position.row];
        const column = columns[position.column];
        if (!editable || row === undefined || column === undefined || row.locked === true || row.state === 'deleted' || column.readOnly === true) {
            return false;
        }
        return !isPreview(row.cells[position.column] ?? null) || loadValue !== undefined;
    };

    const reveal = (position: CellPosition): void => {
        const element = scroller.current;
        if (element === null) {
            return;
        }
        const top = scrollToReveal(HEADER_HEIGHT + position.row * ROW_HEIGHT, ROW_HEIGHT, element.scrollTop, element.clientHeight, HEADER_HEIGHT);
        const left = scrollToReveal(gutter + (offsets[position.column] ?? 0), widths[position.column] ?? 0, element.scrollLeft, element.clientWidth, gutter);
        if (top !== element.scrollTop) {
            element.scrollTop = top;
        }
        if (left !== element.scrollLeft) {
            element.scrollLeft = left;
        }
    };

    const focusAt = (position: CellPosition): void => {
        setFocused(position);
        reveal(position);
    };

    const setSelection = (next: ReadonlySet<string>): void => {
        if (selectedKeys === undefined) {
            setOwnSelection(next);
        }
        onSelectedKeysChange?.(next);
    };

    const beginEdit = async (position: CellPosition): Promise<void> => {
        const row = rows[position.row];
        if (row === undefined || !canEdit(position)) {
            return;
        }
        const cell = row.cells[position.column] ?? null;
        settled.current = false;
        if (!isPreview(cell)) {
            const text = draftOf(cell);
            setEditing({ ...position, draft: text, initial: text, loading: false });
            return;
        }
        setEditing({ ...position, draft: '', initial: '', loading: true });
        const value = await loadValue?.(row.key, position.column);
        setEditing((now) => {
            if (now === null || !now.loading || now.row !== position.row || now.column !== position.column) {
                return now;
            }
            if (value === undefined) {
                return null;
            }
            const text = draftOf(value);
            return { ...now, draft: text, initial: text, loading: false };
        });
    };

    const finishEdit = (commit: boolean, move?: EditMove): void => {
        if (editing === null || settled.current) {
            return;
        }
        settled.current = true;
        const column = columns[editing.column];
        const row = rows[editing.row];
        if (commit && !editing.loading && editing.draft !== editing.initial && column !== undefined && row !== undefined) {
            onCommit?.(row.key, editing.column, parseDraft(editing.draft, column.kind));
        }
        setEditing(null);
        scroller.current?.focus();
        if (move !== undefined) {
            const next = moveFocus(editing, { key: 'Tab', shiftKey: move === 'previous', mod: false }, { rows: rows.length, columns: columns.length, page });
            if (next !== null) {
                focusAt(next);
            }
        }
    };

    const commitValue = (value: EditValue): void => {
        const row = focusCell === null ? undefined : rows[focusCell.row];
        if (focusCell !== null && row !== undefined && canEdit(focusCell)) {
            onCommit?.(row.key, focusCell.column, value);
        }
    };

    const copyFocused = (): void => {
        const row = focusCell === null ? undefined : rows[focusCell.row];
        if (focusCell !== null && row !== undefined) {
            copyText(copyTextOf(row.cells[focusCell.column] ?? null));
        }
    };

    const selectRowAt = (index: number, click: { shiftKey: boolean; mod: boolean }): void => {
        const result = selectRow(
            rows.map((row) => row.key),
            selection,
            anchor.current,
            index,
            click
        );
        anchor.current = result.anchor;
        setSelection(result.selected);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.target !== event.currentTarget || event.altKey) {
            return;
        }
        if (editing !== null) {
            if (event.key === 'Escape') {
                finishEdit(false);
            }
            return;
        }
        const mod = isModHeld(event, isApplePlatform());
        if (mod && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            copyFocused();
        } else if ((event.key === 'Enter' || event.key === 'F2') && focusCell !== null) {
            event.preventDefault();
            void beginEdit(focusCell);
        } else if (event.key === ' ' && event.shiftKey && focusCell !== null) {
            event.preventDefault();
            selectRowAt(focusCell.row, { shiftKey: false, mod });
        } else {
            const next = moveFocus(focusCell, { key: event.key, shiftKey: event.shiftKey, mod }, { rows: rows.length, columns: columns.length, page });
            if (next !== null) {
                event.preventDefault();
                focusAt(next);
            }
        }
    };

    const resizeColumn = (index: number, width: number): void => {
        setSizing((now) => ({ ...now, resized: { ...now.resized, [index]: width } }));
    };

    const renderRow = (index: number): ReactNode => {
        const row = rows[index]!;
        const selected = selection.has(row.key);
        return (
            <div
                key={row.key}
                role="row"
                aria-rowindex={index + 2}
                aria-selected={selected}
                className={clsx(
                    'absolute left-0 flex border-b border-border-soft',
                    row.state === undefined ? (selected ? 'bg-accent-soft/40' : 'hover:bg-surface-hover') : ROW_STATE[row.state]
                )}
                style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT, width: totalWidth }}
            >
                <div
                    role="rowheader"
                    data-selected={selected ? '' : undefined}
                    className={clsx(
                        'sticky left-0 z-10 flex shrink-0 cursor-default items-center justify-end border-r border-border bg-surface-sunken pr-2 pl-1 font-mono text-xs text-text-faint tabular-nums select-none data-[selected]:bg-accent-soft data-[selected]:text-text',
                        row.state === 'inserted' && 'text-positive'
                    )}
                    style={{ width: gutter }}
                    onClick={(event: MouseEvent) => selectRowAt(index, { shiftKey: event.shiftKey, mod: isModHeld(event, isApplePlatform()) })}
                >
                    {row.number === null ? '+' : formatNumber(row.number)}
                </div>
                {columns.map((column, columnIndex) => {
                    const cell = row.cells[columnIndex] ?? null;
                    const view = cellView(cell, column.kind);
                    const isFocused = focusCell !== null && focusCell.row === index && focusCell.column === columnIndex;
                    const isEditing = editing !== null && editing.row === index && editing.column === columnIndex;
                    return (
                        <div
                            key={columnIndex}
                            id={cellId(index, columnIndex)}
                            role="gridcell"
                            aria-colindex={columnIndex + 2}
                            aria-selected={isFocused}
                            data-focused={isFocused ? '' : undefined}
                            className={clsx(
                                'relative flex h-full shrink-0 items-center overflow-hidden border-r border-border-soft px-3 font-mono text-code whitespace-nowrap outline-0 data-[focused]:outline-2 data-[focused]:-outline-offset-2 data-[focused]:outline-border-strong group-focus-within/grid:data-[focused]:outline-accent',
                                view.align === 'end' ? 'justify-end tabular-nums' : 'justify-start',
                                row.edited?.has(columnIndex) === true && 'bg-accent-soft'
                            )}
                            style={{ width: widths[columnIndex] }}
                            onClick={() => focusAt({ row: index, column: columnIndex })}
                            onDoubleClick={() => void beginEdit({ row: index, column: columnIndex })}
                            onContextMenu={() => focusAt({ row: index, column: columnIndex })}
                        >
                            {isEditing && editing.loading && <Spinner size={12} label={t('grid.loadingValue')} />}
                            {isEditing && !editing.loading && (
                                <CellEditor
                                    value={editing.draft}
                                    label={column.name}
                                    onValueChange={(draft) => setEditing({ ...editing, draft })}
                                    onCommit={(move) => finishEdit(true, move)}
                                    onCancel={() => finishEdit(false)}
                                />
                            )}
                            {!isEditing && (
                                <>
                                    <span className={clsx('min-w-0 truncate', TONE[view.tone], row.state === 'deleted' && 'line-through')}>{view.text}</span>
                                    {view.suffix !== undefined && <span className="ml-2 shrink-0 text-text-faint">{view.suffix}</span>}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const settable = focusCell !== null && canEdit(focusCell);
    const nullable = focusCell !== null && columns[focusCell.column]?.nullable !== false;

    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger
                ref={attach}
                role="grid"
                aria-label={label}
                aria-rowcount={rows.length + 1}
                aria-colcount={columns.length + 1}
                aria-activedescendant={focusCell === null ? undefined : cellId(focusCell.row, focusCell.column)}
                tabIndex={0}
                className={clsx('group/grid relative min-h-0 flex-1 overflow-auto bg-surface text-text outline-none', className)}
                onKeyDown={handleKeyDown}
                onScroll={(event) => setScrollTop(Math.floor(event.currentTarget.scrollTop / ROW_HEIGHT) * ROW_HEIGHT)}
            >
                <div className="relative min-w-full" style={{ width: totalWidth }}>
                    <div
                        role="row"
                        aria-rowindex={1}
                        className="sticky top-0 z-20 flex border-b border-border bg-surface-sunken"
                        style={{ height: HEADER_HEIGHT, width: totalWidth }}
                    >
                        <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface-sunken" style={{ width: gutter }} />
                        {columns.map((column, index) => (
                            <GridHeaderCell key={index} column={column} index={index} width={widths[index]!} onResize={resizeColumn} />
                        ))}
                    </div>
                    <div role="rowgroup" className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
                        {Array.from({ length: range.end - range.start }, (_, offset) => renderRow(range.start + offset))}
                    </div>
                    {rows.length === 0 && empty !== undefined && <div className="sticky left-0 w-fit px-4 py-6 text-xs text-text-muted">{empty}</div>}
                </div>
            </ContextMenu.Trigger>
            <ContextMenu.Popup>
                <ContextMenu.Item disabled={focusCell === null} onClick={copyFocused}>
                    <Icon icon={Copy} size={14} />
                    {t('grid.copyValue')}
                    <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                </ContextMenu.Item>
                {editable && (
                    <>
                        <ContextMenu.Separator />
                        <ContextMenu.Item disabled={!settable || !nullable} onClick={() => commitValue(null)}>
                            <Icon icon={Ban} size={14} />
                            {t('grid.setNull')}
                        </ContextMenu.Item>
                        <ContextMenu.Item disabled={!settable} onClick={() => commitValue({ kind: 'default' })}>
                            <Icon icon={RotateCcw} size={14} />
                            {t('grid.setDefault')}
                        </ContextMenu.Item>
                    </>
                )}
            </ContextMenu.Popup>
        </ContextMenu.Root>
    );
}
