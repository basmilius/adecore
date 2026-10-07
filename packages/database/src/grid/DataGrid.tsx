import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    type Ref
} from 'react';
import clsx from 'clsx';
import { Ban, Copy, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, copyText, EDIT_SHORTCUTS, Icon, isApplePlatform, isModHeld, Kbd, Spinner, useContentSize } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { CODE_TEXT } from '../code-text.ts';
import type { EditValue, Value } from '../protocol/index.ts';
import type { SqlTarget } from '../sql.ts';
import type { RangeBlock } from './aggregates.ts';
import { fullRect, rectBetween, rectContains } from './cell-range.ts';
import { CellEditor, type EditMove } from './CellEditor.tsx';
import { captureLayout, restoreLayout, sameLayout, type GridLayout } from './column-layout.ts';
import { NO_COLUMN_SELECTION, selectColumn, shownSelection, type ColumnSelection } from './column-selection.ts';
import { displayOrder, hideColumn, pinnedCount, showAllColumns, togglePin, type ColumnView } from './column-view.ts';
import { COPY_FORMATS, formatCopy, type CopyFormat, type CopyInput } from './copy-formats.ts';
import { CopyAsMenu } from './CopyAsMenu.tsx';
import { cellView, copyTextOf, isPreview, type CellView, type NumberNotation } from './display.ts';
import { draftOf, parseDraft } from './edit-value.ts';
import { parseEnumType } from './enum-type.ts';
import { EnumPicker } from './EnumPicker.tsx';
import { GridHeaderCell, type HeaderActions } from './GridHeaderCell.tsx';
import {
    clampColumnWidth,
    columnOffsets,
    estimateColumnWidth,
    fitColumnWidth,
    FALLBACK_VIEWPORT_HEIGHT,
    growWidths,
    gutterWidth,
    HEADER_HEIGHT,
    OVERSCAN_ROWS,
    ROW_HEIGHT,
    scrollToReveal,
    visibleRange
} from './layout.ts';
import { moveFocus, type CellPosition, type NavigationKey } from './navigation.ts';
import { selectRow } from './row-selection.ts';
import { sortOnly, sortStateOf, type GridSort } from './sort.ts';
import type { ColumnRequest, FocusedCell, GridColumn, GridMenuContext, GridRow } from './types.ts';
import { useNumberNotation } from '../client-context.ts';
import { usePopupPress } from '../use-popup-press.ts';

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
    /* The sorted columns by name, in order. Only shown unless `onSortsChange` is given, which is what makes the headers sort. */
    sorts?: readonly GridSort[];
    onSortsChange?(sorts: readonly GridSort[]): void;
    /* The cell that holds the focus changed, or lost it. */
    onFocusedCellChange?(cell: FocusedCell | null): void;
    /* Delete or Backspace with rows selected. */
    onDeleteSelected?(): void;
    /* The table the rows come from, which "Copy as SQL INSERT" writes statements for. Without it that format is not offered. */
    sqlTarget?: SqlTarget;
    /* Items that filter or sort by the cell under the pointer, drawn under Copy as. Not drawn for a row number. */
    queryMenu?(context: GridMenuContext): ReactNode;
    /* Items for the end of the context menu of a cell or a row number, after the grid's own. */
    menu?(context: GridMenuContext): ReactNode;
    /* Mod+D on the selected rows, or on the row with the focus when none is selected. */
    onDuplicateRows?(rowKeys: readonly string[]): void;
    /* Draws an arrow on the cells `canFollow` allows, and runs on a click on it or a Mod+click on the cell. */
    onFollow?(cell: FocusedCell): void;
    /* Without it every cell can be followed. */
    canFollow?(cell: FocusedCell): boolean;
    /* The block of cells the range covers, or `null` when no cell has focus. Told again when the block changes. */
    onRangeChange?(block: RangeBlock | null): void;
    /* The widths, hidden columns and pins to start from, by column name. Read when the columns first appear. */
    initialLayout?: GridLayout;
    /* A person resized, hid or pinned a column. */
    onLayoutChange?(layout: GridLayout): void;
    /* Puts the focus on a cell, whenever the object changes. */
    focusRequest?: FocusedCell | null;
    /* Picks a column and brings it into view, whenever the object changes. */
    columnRequest?: ColumnRequest | null;
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

interface MenuTarget {
    readonly row: number;
    /* `null` for the row number. */
    readonly column: number | null;
}

/* What the person did to the columns, kept while the same columns come back with new rows. */
interface Layout {
    signature: string;
    rows: readonly GridRow[];
    notation: NumberNotation;
    estimated: readonly number[];
    resized: Readonly<Record<number, number>>;
    view: ColumnView;
}

const NO_KEYS: ReadonlySet<string> = new Set();
const NO_SORTS: readonly GridSort[] = [];

const signatureOf = (columns: readonly GridColumn[]): string => columns.map((column) => column.name).join('\u0000');

const textOf = (view: CellView): string => (view.suffix === undefined ? view.text : `${view.text} ${view.suffix}`);

const estimateWidths = (columns: readonly GridColumn[], rows: readonly GridRow[], notation: NumberNotation): number[] =>
    columns.map((column, index) =>
        estimateColumnWidth(
            column.name,
            rows.slice(0, 50).map((row) => textOf(cellView(row.cells[index] ?? null, column.kind, notation))),
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
    sorts,
    onSortsChange,
    onFocusedCellChange,
    onDeleteSelected,
    sqlTarget,
    queryMenu,
    menu,
    onDuplicateRows,
    onFollow,
    canFollow,
    onRangeChange,
    initialLayout,
    onLayoutChange,
    focusRequest,
    columnRequest,
    empty,
    className,
    ref
}: DataGridProps) {
    const { t } = useTranslation('database');
    const gridId = useId();
    const scroller = useRef<HTMLDivElement | null>(null);
    const anchor = useRef(-1);
    const pressedInPopup = usePopupPress();
    const notation = useNumberNotation();
    /* Set once an edit commits or cancels, so the blur that follows the input's removal does not commit it again. */
    const settled = useRef(true);
    const dragging = useRef(false);
    const dragOrigin = useRef<CellPosition | null>(null);
    const reportFocus = useRef(onFocusedCellChange);
    const reportRange = useRef(onRangeChange);
    const reportLayout = useRef(onLayoutChange);
    const [measure, size] = useContentSize();
    const [scrollTop, setScrollTop] = useState(0);
    const [focused, setFocused] = useState<CellPosition | null>(null);
    const [rangeAnchor, setRangeAnchor] = useState<CellPosition | null>(null);
    const [columnSelection, setColumnSelection] = useState<ColumnSelection>(NO_COLUMN_SELECTION);
    const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [ownSelection, setOwnSelection] = useState<ReadonlySet<string>>(NO_KEYS);
    const [layout, setLayout] = useState<Layout>(() => ({
        signature: signatureOf(columns),
        rows,
        notation,
        estimated: estimateWidths(columns, rows, notation),
        ...restoreLayout(columns, initialLayout)
    }));
    const reportedLayout = useRef<GridLayout>(captureLayout(columns, layout));

    const signature = signatureOf(columns);
    let current = layout;
    if (layout.signature !== signature || layout.rows !== rows || layout.notation !== notation) {
        const same = layout.signature === signature;
        const estimated = estimateWidths(columns, rows, notation);
        current = {
            signature,
            rows,
            notation,
            estimated: same ? growWidths(layout.estimated, estimated) : estimated,
            ...(same ? { resized: layout.resized, view: layout.view } : restoreLayout(columns, initialLayout))
        };
        setLayout(current);
    }

    const order = displayOrder(columns.length, current.view);
    const pinnedShown = pinnedCount(columns.length, current.view);
    const displayOf = new Map(order.map((index, position) => [index, position]));
    const widths = columns.map((_, index) => current.resized[index] ?? current.estimated[index] ?? clampColumnWidth(0));
    const shownWidths = order.map((index) => widths[index]!);
    const offsets = columnOffsets(shownWidths);
    const gutter = gutterWidth(rows.length);
    const totalWidth = gutter + shownWidths.reduce((sum, width) => sum + width, 0);
    const pinnedWidth = shownWidths.slice(0, pinnedShown).reduce((sum, width) => sum + width, 0);
    const viewportHeight = size.height > 0 ? size.height : FALLBACK_VIEWPORT_HEIGHT;
    const range = visibleRange(scrollTop - HEADER_HEIGHT, viewportHeight, ROW_HEIGHT, rows.length, OVERSCAN_ROWS);
    const selection = selectedKeys ?? ownSelection;
    const isShown = (position: CellPosition | null): position is CellPosition =>
        position !== null && position.row < rows.length && displayOf.has(position.column);
    const focusCell = isShown(focused) ? focused : null;
    const anchorCell = isShown(rangeAnchor) ? rangeAnchor : null;
    const toDisplay = (position: CellPosition): CellPosition => ({ row: position.row, column: displayOf.get(position.column)! });
    const fromDisplay = (position: CellPosition): CellPosition => ({ row: position.row, column: order[position.column]! });
    const rect = focusCell === null ? null : rectBetween(toDisplay(anchorCell ?? focusCell), toDisplay(focusCell));
    const page = Math.max(1, Math.floor((viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT));
    const sortable = onSortsChange !== undefined;
    const sortList = sorts ?? NO_SORTS;
    const focusedRowKey = focusCell === null ? null : (rows[focusCell.row]?.key ?? null);
    const focusedColumn = focusCell?.column ?? -1;
    const pickedColumns = shownSelection(columnSelection, order);
    const pickedSet = new Set(pickedColumns);
    const columnBlock: RangeBlock | null = pickedColumns.length > 0 && rows.length > 0 ? { top: 0, bottom: rows.length - 1, columns: pickedColumns } : null;
    const cellBlock: RangeBlock | null = rect === null ? null : { top: rect.top, bottom: rect.bottom, columns: order.slice(rect.left, rect.right + 1) };
    const block = columnBlock ?? cellBlock;
    const blockKey = block === null ? '' : `${block.top}:${block.bottom}:${block.columns.join(',')}`;
    const headerId = (column: number): string => `${gridId}-h-${column}`;
    const enumTypes = useMemo(() => columns.map((column) => parseEnumType(column.type)), [columns]);

    useEffect(() => {
        reportFocus.current = onFocusedCellChange;
    });

    useEffect(() => {
        reportRange.current = onRangeChange;
        reportLayout.current = onLayoutChange;
    });

    useEffect(() => {
        const captured = captureLayout(columns, current);
        if (!sameLayout(captured, reportedLayout.current)) {
            reportedLayout.current = captured;
            reportLayout.current?.(captured);
        }
    }, [columns, current]);

    useEffect(() => {
        reportFocus.current?.(focusedRowKey === null ? null : { rowKey: focusedRowKey, column: focusedColumn });
    }, [focusedRowKey, focusedColumn]);

    useEffect(() => {
        if (blockKey === '') {
            reportRange.current?.(null);
            return;
        }
        const [top, bottom, list] = blockKey.split(':');
        reportRange.current?.({ top: Number(top), bottom: Number(bottom), columns: list === '' ? [] : list!.split(',').map(Number) });
    }, [blockKey]);

    useEffect(() => {
        const index = focusRequest === null || focusRequest === undefined ? -1 : rows.findIndex((row) => row.key === focusRequest.rowKey);
        if (focusRequest !== null && focusRequest !== undefined && index >= 0) {
            focusAt({ row: index, column: focusRequest.column });
            scroller.current?.focus();
        }
        // Only a new request moves the focus; the rows changing under a request already handled must not.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [focusRequest]);

    useEffect(() => {
        if (columnRequest !== null && columnRequest !== undefined && displayOf.has(columnRequest.column)) {
            pickColumn(columnRequest.column);
            revealColumn(columnRequest.column);
            scroller.current?.focus();
        }
        // Only a new request moves the pick; the columns changing under a request already handled must not.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [columnRequest]);

    useEffect(() => {
        const stop = (): void => {
            dragging.current = false;
        };
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        return () => {
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
    }, []);

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

    const revealColumn = (column: number): void => {
        const element = scroller.current;
        const at = displayOf.get(column);
        if (element === null || at === undefined || at < pinnedShown) {
            return;
        }
        const left = scrollToReveal(gutter + (offsets[at] ?? 0), shownWidths[at] ?? 0, element.scrollLeft, element.clientWidth, gutter + pinnedWidth);
        if (left !== element.scrollLeft) {
            element.scrollLeft = left;
        }
    };

    const reveal = (position: CellPosition): void => {
        const element = scroller.current;
        if (element === null) {
            return;
        }
        const top = scrollToReveal(HEADER_HEIGHT + position.row * ROW_HEIGHT, ROW_HEIGHT, element.scrollTop, element.clientHeight, HEADER_HEIGHT);
        if (top !== element.scrollTop) {
            element.scrollTop = top;
        }
        revealColumn(position.column);
    };

    const pickColumn = (column: number, click = { shiftKey: false, mod: false }): void => {
        setColumnSelection((now) => selectColumn(now, order, column, click));
        setRangeAnchor(null);
    };

    /* With `extend` the range grows from where it started; otherwise the cell stands alone. */
    const focusAt = (position: CellPosition, extend = false): void => {
        setColumnSelection(NO_COLUMN_SELECTION);
        setRangeAnchor(extend && focusCell !== null ? (anchorCell ?? focusCell) : null);
        setFocused(position);
        reveal(position);
    };

    const step = (from: CellPosition | null, input: NavigationKey): CellPosition | null => {
        const next = moveFocus(isShown(from) ? toDisplay(from) : null, input, { rows: rows.length, columns: order.length, page });
        return next === null ? null : fromDisplay(next);
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
            const next = step(editing, { key: 'Tab', shiftKey: move === 'previous', mod: false });
            if (next !== null) {
                focusAt(next);
            }
        }
    };

    const finishPick = (result: { readonly value: string | null } | undefined): void => {
        if (editing === null || settled.current) {
            return;
        }
        settled.current = true;
        const row = rows[editing.row];
        const before = row?.cells[editing.column] ?? null;
        if (result !== undefined && row !== undefined && result.value !== (typeof before === 'string' ? before : null)) {
            onCommit?.(row.key, editing.column, result.value);
        }
        setEditing(null);
        scroller.current?.focus();
    };

    const followCell = (cell: FocusedCell): boolean => onFollow !== undefined && (canFollow?.(cell) ?? true);

    const commitValue = (value: EditValue): void => {
        const position = menuTarget === null || menuTarget.column === null ? null : { row: menuTarget.row, column: menuTarget.column };
        const row = position === null ? undefined : rows[position.row];
        if (position !== null && row !== undefined && canEdit(position)) {
            onCommit?.(row.key, position.column, value);
        }
    };

    /* The cells of the range or of the picked columns, as the columns and rows a copy writes. */
    const blockOf = (): CopyInput | null => {
        if (block === null) {
            return null;
        }
        return {
            columns: block.columns.map((index) => ({ name: columns[index]!.name, kind: columns[index]!.kind })),
            rows: rows.slice(block.top, block.bottom + 1).map((row) => block.columns.map((index) => row.cells[index] ?? null)),
            target: sqlTarget
        };
    };

    const copyAs = (format: CopyFormat): void => {
        const block = blockOf();
        if (block !== null) {
            copyText(formatCopy(format, block));
        }
    };

    /* One cell copies as it reads; a block copies as TSV, which a spreadsheet pastes into cells. */
    const copyRange = (): void => {
        if (block !== null && block.top === block.bottom && block.columns.length === 1) {
            copyText(copyTextOf(rows[block.top]?.cells[block.columns[0]!] ?? null));
        } else {
            copyAs('tsv');
        }
    };

    const copyCell = (): void => {
        const row = menuTarget === null ? undefined : rows[menuTarget.row];
        if (row !== undefined && menuTarget?.column != null) {
            copyText(copyTextOf(row.cells[menuTarget.column] ?? null));
        }
    };

    const selectAll = (): void => {
        const all = fullRect(rows.length, order.length);
        if (all !== null) {
            setColumnSelection(NO_COLUMN_SELECTION);
            setRangeAnchor(fromDisplay({ row: all.top, column: all.left }));
            setFocused(fromDisplay({ row: all.bottom, column: all.right }));
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
        if (!click.mod && order.length > 0) {
            setColumnSelection(NO_COLUMN_SELECTION);
            setRangeAnchor({ row: result.anchor, column: order[order.length - 1]! });
            setFocused({ row: index, column: order[0]! });
        }
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
        const key = event.key.toLowerCase();
        if (mod && key === 'c') {
            event.preventDefault();
            copyRange();
        } else if (mod && key === 'a') {
            event.preventDefault();
            selectAll();
        } else if (mod && key === 'd' && onDuplicateRows !== undefined) {
            event.preventDefault();
            const keys =
                selection.size > 0 ? rows.filter((row) => selection.has(row.key)).map((row) => row.key) : focusedRowKey === null ? [] : [focusedRowKey];
            if (keys.length > 0) {
                onDuplicateRows(keys);
            }
        } else if ((event.key === 'Enter' || event.key === 'F2') && focusCell !== null) {
            event.preventDefault();
            void beginEdit(focusCell);
        } else if (event.key === ' ' && event.shiftKey && focusCell !== null) {
            event.preventDefault();
            selectRowAt(focusCell.row, { shiftKey: false, mod });
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && onDeleteSelected !== undefined && selection.size > 0) {
            event.preventDefault();
            onDeleteSelected();
        } else if (event.key === 'Escape' && (anchorCell !== null || columnSelection.columns.size > 0)) {
            setRangeAnchor(null);
            setColumnSelection(NO_COLUMN_SELECTION);
        } else {
            const next = step(focusCell, { key: event.key, shiftKey: event.shiftKey, mod });
            if (next !== null) {
                event.preventDefault();
                focusAt(next, event.shiftKey && event.key !== 'Tab');
            }
        }
    };

    const pressCell = (event: PointerEvent, position: CellPosition, isEditing: boolean): void => {
        if (event.button !== 0 || isEditing) {
            return;
        }
        const row = rows[position.row];
        if (row !== undefined && isModHeld(event, isApplePlatform()) && followCell({ rowKey: row.key, column: position.column })) {
            focusAt(position);
            onFollow?.({ rowKey: row.key, column: position.column });
            return;
        }
        const extend = event.shiftKey && focusCell !== null;
        dragOrigin.current = extend ? (anchorCell ?? focusCell) : position;
        dragging.current = true;
        focusAt(position, extend);
    };

    const dragTo = (position: CellPosition): void => {
        if (dragging.current && dragOrigin.current !== null) {
            setRangeAnchor(dragOrigin.current);
            setFocused(position);
        }
    };

    const openCellMenu = (position: CellPosition): void => {
        if (!rectContains(rect, position.row, displayOf.get(position.column)!)) {
            focusAt(position);
        }
        setMenuTarget(position);
    };

    const openRowMenu = (index: number): void => {
        const row = rows[index];
        if (row !== undefined && !selection.has(row.key)) {
            selectRowAt(index, { shiftKey: false, mod: false });
        }
        setMenuTarget({ row: index, column: null });
    };

    const resizeColumn = (index: number, width: number): void => {
        setLayout((now) => ({ ...now, resized: { ...now.resized, [index]: width } }));
    };

    const fitColumn = (index: number): void => {
        const column = columns[index];
        if (column !== undefined) {
            resizeColumn(
                index,
                fitColumnWidth(
                    column.name,
                    rows.map((row) => textOf(cellView(row.cells[index] ?? null, column.kind, notation))),
                    column.primaryKey === true
                )
            );
        }
    };

    const changeView = (change: (view: ColumnView) => ColumnView): void => {
        setLayout((now) => ({ ...now, view: change(now.view) }));
    };

    const headerActions: HeaderActions = {
        onSelect: (index, click) => {
            if (!pressedInPopup()) {
                pickColumn(index, click);
            }
        },
        onSortDirection: (index, direction) => onSortsChange?.(sortOnly(columns[index]!.name, direction)),
        onClearSort: () => onSortsChange?.([]),
        onResize: resizeColumn,
        onFit: fitColumn,
        onHide: (index) => changeView((view) => hideColumn(view, index)),
        onShowAll: () => changeView(showAllColumns),
        onTogglePin: (index) => changeView((view) => togglePin(view, index))
    };

    const renderRow = (index: number): ReactNode => {
        const row = rows[index]!;
        const selected = selection.has(row.key);
        const tint = row.state === undefined ? (selected ? 'bg-accent-soft/40' : '') : ROW_STATE[row.state];
        return (
            <div
                key={row.key}
                role="row"
                aria-rowindex={index + 2}
                aria-selected={selected}
                className={clsx('group/row absolute inset-x-0 flex border-b border-border-soft', tint, tint === '' && 'hover:bg-surface-hover')}
                style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
                <div
                    role="rowheader"
                    data-selected={selected ? '' : undefined}
                    className={clsx(
                        'sticky left-0 z-10 flex shrink-0 cursor-default items-center justify-end border-r border-border bg-surface pr-2 pl-1 font-mono text-xs text-text-faint tabular-nums select-none data-[selected]:bg-accent-soft data-[selected]:text-text',
                        row.state === 'inserted' && 'text-positive'
                    )}
                    style={{ width: gutter }}
                    onClick={(event: MouseEvent) => {
                        if (!pressedInPopup()) {
                            selectRowAt(index, { shiftKey: event.shiftKey, mod: isModHeld(event, isApplePlatform()) });
                        }
                    }}
                    onContextMenu={() => openRowMenu(index)}
                >
                    {row.number === null ? '+' : formatNumber(row.number)}
                </div>
                {order.map((columnIndex, position) => {
                    const column = columns[columnIndex]!;
                    const cell = row.cells[columnIndex] ?? null;
                    const view = cellView(cell, column.kind, notation);
                    const cellPosition = { row: index, column: columnIndex };
                    const isFocused = focusCell !== null && focusCell.row === index && focusCell.column === columnIndex;
                    const ranged = pickedSet.has(columnIndex) || (columnBlock === null && rectContains(rect, index, position));
                    const edited = row.edited?.has(columnIndex) === true;
                    const isEditing = editing !== null && editing.row === index && editing.column === columnIndex;
                    const pinned = position < pinnedShown;
                    const enumType = enumTypes[columnIndex] ?? null;
                    return (
                        <div
                            key={columnIndex}
                            id={cellId(index, columnIndex)}
                            role="gridcell"
                            aria-colindex={position + 2}
                            aria-selected={ranged}
                            data-focused={isFocused ? '' : undefined}
                            data-ranged={ranged ? '' : undefined}
                            className={clsx(
                                CODE_TEXT,
                                'flex h-full shrink-0 items-center overflow-hidden px-3 whitespace-nowrap outline-0 select-none data-[focused]:outline-1 data-[focused]:-outline-offset-1 data-[focused]:outline-border-strong group-focus-within/grid:data-[focused]:outline-accent',
                                position === order.length - 1 ? 'border-r-0' : 'border-r',
                                view.align === 'end' ? 'justify-end tabular-nums' : 'justify-start',
                                pinned
                                    ? [
                                          'sticky z-5',
                                          position === pinnedShown - 1 ? 'border-border-strong' : 'border-border-soft',
                                          ranged ? 'bg-accent-soft' : ['bg-surface', tint === '' && 'group-hover/row:bg-surface-hover']
                                      ]
                                    : ['relative border-border-soft', ranged ? 'bg-accent-soft' : edited && 'bg-accent/10']
                            )}
                            style={{ width: shownWidths[position], left: pinned ? gutter + (offsets[position] ?? 0) : undefined }}
                            onPointerDown={(event) => pressCell(event, cellPosition, isEditing)}
                            onPointerEnter={() => dragTo(cellPosition)}
                            onDoubleClick={() => void beginEdit(cellPosition)}
                            onContextMenu={() => openCellMenu(cellPosition)}
                        >
                            {pinned && !ranged && <span aria-hidden className={clsx('pointer-events-none absolute inset-0', tint, edited && 'bg-accent/10')} />}
                            {isEditing && editing.loading && <Spinner size={12} label={t('grid.loadingValue')} />}
                            {isEditing && !editing.loading && enumType !== null && (
                                <EnumPicker
                                    autoOpen
                                    type={enumType}
                                    value={typeof cell === 'string' ? cell : null}
                                    nullable={column.nullable !== false}
                                    label={column.name}
                                    onDone={finishPick}
                                />
                            )}
                            {isEditing && !editing.loading && enumType === null && (
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

    const menuRow = menuTarget === null ? undefined : rows[menuTarget.row];
    const menuCell: CellPosition | null = menuTarget === null || menuTarget.column === null ? null : { row: menuTarget.row, column: menuTarget.column };
    const settable = menuCell !== null && canEdit(menuCell);
    const nullable = menuCell !== null && columns[menuCell.column]?.nullable !== false;
    const menuColumn = menuCell === null ? undefined : columns[menuCell.column];
    const hasDefault = menuColumn !== undefined && ((menuColumn.defaultValue ?? null) !== null || menuColumn.autoIncrement === true);
    const menuContext: GridMenuContext | null =
        menuRow === undefined || menuTarget === null
            ? null
            : {
                  rowKeys: selection.has(menuRow.key) ? rows.filter((row) => selection.has(row.key)).map((row) => row.key) : [menuRow.key],
                  cell: menuTarget.column === null ? null : { rowKey: menuRow.key, column: menuTarget.column }
              };

    return (
        <div
            ref={attach}
            role="grid"
            aria-label={label}
            aria-rowcount={rows.length + 1}
            aria-colcount={order.length + 1}
            aria-activedescendant={
                pickedColumns.length > 0 ? headerId(pickedColumns[0]!) : focusCell === null ? undefined : cellId(focusCell.row, focusCell.column)
            }
            tabIndex={0}
            className={clsx('group/grid relative min-h-0 flex-1 overflow-auto bg-surface text-text outline-none', className)}
            onKeyDown={handleKeyDown}
            onScroll={(event) => setScrollTop(Math.floor(event.currentTarget.scrollTop / ROW_HEIGHT) * ROW_HEIGHT)}
        >
            <div className="relative min-w-full" style={{ width: totalWidth }}>
                <div role="row" aria-rowindex={1} className="sticky top-0 z-20 flex w-full border-b border-border bg-surface" style={{ height: HEADER_HEIGHT }}>
                    <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface" style={{ width: gutter }} />
                    {order.map((columnIndex, position) => {
                        const column = columns[columnIndex]!;
                        return (
                            <GridHeaderCell
                                key={columnIndex}
                                column={column}
                                index={columnIndex}
                                position={position}
                                width={shownWidths[position]!}
                                sortable={sortable}
                                selected={pickedSet.has(columnIndex)}
                                id={headerId(columnIndex)}
                                sort={sortable ? sortStateOf(sortList, column.name) : null}
                                multipleSorts={sortList.length > 1}
                                hasSorts={sortList.length > 0}
                                pinned={position < pinnedShown}
                                stickyLeft={gutter + (offsets[position] ?? 0)}
                                lastPinned={position === pinnedShown - 1}
                                last={position === order.length - 1}
                                hasHidden={current.view.hidden.size > 0}
                                canHide={order.length > 1}
                                actions={headerActions}
                            />
                        );
                    })}
                </div>
                <ContextMenu.Root>
                    <ContextMenu.Trigger role="rowgroup" className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
                        {Array.from({ length: range.end - range.start }, (_, offset) => renderRow(range.start + offset))}
                    </ContextMenu.Trigger>
                    <ContextMenu.Popup>
                        <ContextMenu.Item disabled={menuCell === null} onClick={copyCell}>
                            <Icon icon={Copy} size={14} />
                            {t('grid.copyValue')}
                            <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                        </ContextMenu.Item>
                        <CopyAsMenu
                            disabled={block === null}
                            formats={sqlTarget === undefined ? COPY_FORMATS.filter((format) => format !== 'sql') : COPY_FORMATS}
                            onCopy={copyAs}
                        />
                        {menuContext !== null && menuCell !== null && queryMenu !== undefined && (
                            <>
                                <ContextMenu.Separator />
                                {queryMenu(menuContext)}
                            </>
                        )}
                        <ContextMenu.Separator />
                        {editable && menuCell !== null && (
                            <>
                                <ContextMenu.Item disabled={!settable || !nullable} onClick={() => commitValue(null)}>
                                    <Icon icon={Ban} size={14} />
                                    {t('grid.setNull')}
                                </ContextMenu.Item>
                                {hasDefault && (
                                    <ContextMenu.Item disabled={!settable} onClick={() => commitValue({ kind: 'default' })}>
                                        <Icon icon={RotateCcw} size={14} />
                                        {t('grid.setDefault')}
                                    </ContextMenu.Item>
                                )}
                            </>
                        )}
                        {menuContext !== null && menu?.(menuContext)}
                    </ContextMenu.Popup>
                </ContextMenu.Root>
                {rows.length === 0 && empty !== undefined && <div className="sticky left-0 w-fit px-4 py-6 text-xs text-text-muted">{empty}</div>}
            </div>
        </div>
    );
}
