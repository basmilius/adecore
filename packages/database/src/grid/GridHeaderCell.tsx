import { useRef, type MouseEvent, type PointerEvent } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Copy, Eye, EyeOff, Pin, PinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ColumnResizeHandle, ContextMenu, copyText, Icon, IconButton, isApplePlatform, isModHeld, Menu, Tooltip, useColumnResize } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { CODE_TEXT } from '../code-text.ts';
import { keyLabelOf } from '../column-keys.ts';
import { KeyIcon } from '../KeyIcon.tsx';
import { isNumericKind, type SortDirection } from '../sql.ts';
import type { ColumnClick } from './column-selection.ts';
import { isDoubleClick, MAX_RESIZED_WIDTH, MIN_COLUMN_WIDTH } from './layout.ts';
import type { GridColumn } from './types.ts';

/* What a header can ask the grid for. Every call names the column by its index in the columns the grid was given. */
export interface HeaderActions {
    /* A click on the head picks its column; Shift extends the pick to a range and Mod toggles the column. */
    onSelect(index: number, click: ColumnClick): void;
    onSortDirection(index: number, direction: SortDirection): void;
    onClearSort(): void;
    onResize(index: number, width: number): void;
    onFit(index: number): void;
    onHide(index: number): void;
    onShowAll(): void;
    onTogglePin(index: number): void;
}

export interface GridHeaderCellProps {
    column: GridColumn;
    /* Position among the columns the grid was given, counted from zero. */
    index: number;
    /* Position among the columns drawn, counted from zero. */
    position: number;
    width: number;
    /* Whether the grid offers sorting at all, which its menu then holds. */
    sortable: boolean;
    /* Whether the column is one of those picked; the head then wears the accent. */
    selected: boolean;
    /* The DOM id the grid points `aria-activedescendant` at while columns are picked. */
    id: string;
    sort: { direction: SortDirection; position: number } | null;
    /* Whether more than one column is sorted, which numbers the arrows. */
    multipleSorts: boolean;
    hasSorts: boolean;
    pinned: boolean;
    /* The pinned column the others scroll under, which carries the stronger edge. */
    lastPinned: boolean;
    last: boolean;
    hasHidden: boolean;
    canHide: boolean;
    actions: HeaderActions;
}

type MenuProps = Pick<GridHeaderCellProps, 'column' | 'index' | 'sortable' | 'hasSorts' | 'pinned' | 'hasHidden' | 'canHide' | 'actions'>;

/* The items of the menu a header opens, from its button and from a right click. */
function HeaderMenuItems({ column, index, sortable, hasSorts, pinned, hasHidden, canHide, actions }: MenuProps) {
    const { t } = useTranslation('database');
    return (
        <>
            {sortable && (
                <>
                    <Menu.Item onClick={() => actions.onSortDirection(index, 'asc')}>
                        <Icon icon={ArrowUp} size={14} />
                        {t('grid.column.sortAscending')}
                    </Menu.Item>
                    <Menu.Item onClick={() => actions.onSortDirection(index, 'desc')}>
                        <Icon icon={ArrowDown} size={14} />
                        {t('grid.column.sortDescending')}
                    </Menu.Item>
                    <Menu.Item disabled={!hasSorts} onClick={actions.onClearSort}>
                        <Icon icon={ArrowUpDown} size={14} />
                        {t('grid.column.clearSorting')}
                    </Menu.Item>
                    <Menu.Separator />
                </>
            )}
            <Menu.Item disabled={!canHide} onClick={() => actions.onHide(index)}>
                <Icon icon={EyeOff} size={14} />
                {t('grid.column.hide')}
            </Menu.Item>
            {hasHidden && (
                <Menu.Item onClick={actions.onShowAll}>
                    <Icon icon={Eye} size={14} />
                    {t('grid.column.showAll')}
                </Menu.Item>
            )}
            <Menu.Item onClick={() => actions.onTogglePin(index)}>
                <Icon icon={pinned ? PinOff : Pin} size={14} />
                {t(pinned ? 'grid.column.unpin' : 'grid.column.pin')}
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={() => copyText(column.name)}>
                <Icon icon={Copy} size={14} />
                {t('grid.column.copyName')}
            </Menu.Item>
        </>
    );
}

/* The facts about a table column that a tooltip can carry: its type, whether it takes NULL, its default. */
function ColumnFacts({ column }: { column: GridColumn }) {
    const { t } = useTranslation('database');
    const keys = { primaryKey: column.primaryKey === true, foreignKey: column.foreignKey === true };
    const facts = [
        keys.primaryKey || keys.foreignKey ? t(keyLabelOf(keys)) : null,
        column.type === '' ? null : column.type,
        column.nullable === undefined ? null : t(column.nullable ? 'grid.column.nullable' : 'grid.column.notNull'),
        column.defaultValue === undefined || column.defaultValue === null ? null : t('grid.column.default', { value: column.defaultValue }),
        column.autoIncrement === true ? t('grid.column.autoIncrement') : null
    ].filter((fact) => fact !== null);
    return (
        <>
            <span className="block">{column.name}</span>
            {facts.length > 0 && <span className="block">{facts.join(', ')}</span>}
        </>
    );
}

/* One column's head: its name, the sort it carries, the key of a key column, a menu and the strip that resizes it. Numbers sit against the end, like their cells. */
export function GridHeaderCell({
    column,
    index,
    position,
    width,
    sortable,
    selected,
    id,
    sort,
    multipleSorts,
    hasSorts,
    pinned,
    lastPinned,
    last,
    hasHidden,
    canHide,
    actions
}: GridHeaderCellProps) {
    const { t } = useTranslation('database');
    const cell = useRef<HTMLDivElement>(null);
    const lastPress = useRef<number | null>(null);
    // Set by a press on the resize strip, since the click that ends the drag would otherwise pick the column.
    const resized = useRef(false);
    const { startResize } = useColumnResize(cell, {
        size: width,
        min: MIN_COLUMN_WIDTH,
        from: 'left',
        max: () => MAX_RESIZED_WIDTH,
        onSize: (size) => actions.onResize(index, size)
    });

    const pressHandle = (event: PointerEvent<HTMLElement>): void => {
        resized.current = true;
        if (isDoubleClick(lastPress.current, event.timeStamp)) {
            lastPress.current = null;
            actions.onFit(index);
            return;
        }
        lastPress.current = event.timeStamp;
        startResize(event);
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
        const target = event.target as Element;
        // A click inside a menu popup reaches here through the React tree, not the DOM.
        if (!event.currentTarget.contains(target) || target.closest('button') !== null) {
            return;
        }
        if (resized.current) {
            resized.current = false;
            return;
        }
        actions.onSelect(index, { shiftKey: event.shiftKey, mod: isModHeld(event, isApplePlatform()) });
    };

    const menuProps = { column, index, sortable, hasSorts, pinned, hasHidden, canHide, actions };
    const numeric = isNumericKind(column.kind);

    return (
        <ContextMenu.Root>
            <div
                ref={cell}
                id={id}
                role="columnheader"
                aria-colindex={position + 2}
                aria-selected={selected}
                aria-sort={sortable ? (sort === null ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                data-selected={selected ? '' : undefined}
                className={clsx(
                    // The name in the face and size of the cells under it, which is how the column is written in SQL too.
                    'group/header flex h-full shrink-0 cursor-default font-medium select-none',
                    CODE_TEXT,
                    'relative',
                    pinned && 'bg-clip-border',
                    selected ? 'bg-accent text-accent-text' : [pinned && 'bg-surface', sort === null ? 'text-text-muted' : 'text-text'],
                    last ? 'border-r-0' : 'border-r',
                    pinned && lastPinned ? 'border-border-strong' : 'border-border-soft'
                )}
                style={{ width }}
                onPointerDownCapture={() => {
                    resized.current = false;
                }}
                onClick={handleClick}
            >
                <ContextMenu.Trigger
                    className={clsx(
                        'flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-3',
                        numeric && 'justify-end group-data-[selected]/header:pr-8'
                    )}
                >
                    <KeyIcon primaryKey={column.primaryKey === true} foreignKey={column.foreignKey === true} size={12} />
                    <Tooltip label={<ColumnFacts column={column} />} side="bottom">
                        <span className="min-w-0 truncate">{column.name}</span>
                    </Tooltip>
                    {sort !== null && (
                        <span className={clsx('flex shrink-0 items-center gap-0.5', selected ? 'text-accent-text' : 'text-text-muted')}>
                            <Icon icon={sort.direction === 'asc' ? ArrowUp : ArrowDown} size={12} />
                            {multipleSorts && <span className="tabular-nums">{formatNumber(sort.position)}</span>}
                        </span>
                    )}
                </ContextMenu.Trigger>
                <Menu.Root>
                    <IconButton
                        render={<Menu.Trigger />}
                        icon={ChevronDown}
                        size="xs"
                        label={t('grid.column.menu')}
                        tooltip={false}
                        className={clsx(
                            'absolute top-1/2 right-2 -translate-y-1/2',
                            selected
                                ? 'bg-transparent text-accent-text'
                                : 'bg-surface opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100'
                        )}
                    />
                    <Menu.Popup>
                        <HeaderMenuItems {...menuProps} />
                    </Menu.Popup>
                </Menu.Root>
                <ColumnResizeHandle from="left" onPointerDown={pressHandle} className="hover:bg-border-strong" />
            </div>
            <ContextMenu.Popup>
                <HeaderMenuItems {...menuProps} />
            </ContextMenu.Popup>
        </ContextMenu.Root>
    );
}
