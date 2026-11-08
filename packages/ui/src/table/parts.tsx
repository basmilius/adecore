import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
    Children,
    createContext,
    useContext,
    useId,
    type ComponentProps,
    type CSSProperties,
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    type Ref
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon.tsx';
import { ScrollArea } from '../ScrollArea.tsx';
import { Skeleton } from '../Skeleton.tsx';

/* The container sizes of the theme, measured on the table itself rather than the window, so a table in a narrow dialog drops its columns too. */
export type TableBreakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type TableSort = 'none' | 'asc' | 'desc';
export type TableDensity = 'regular' | 'compact';

export interface TableColumnLayout {
    /* A grid track: `minmax(0,2fr)`, `auto`, `120px`. */
    width: string;

    /* `end` for numbers, which then line up in tabular figures. Every cell of the column follows it. */
    align?: 'start' | 'end';

    /* The column and its cells leave while the table is narrower than this. */
    hideBelow?: TableBreakpoint;
}

const BREAKPOINTS: readonly TableBreakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl'];

/* A narrower query comes later in the CSS, so it wins over a wider one. */
const TEMPLATE_BELOW = {
    sm: '@max-sm:grid-cols-(--table-columns-sm)',
    md: '@max-md:grid-cols-(--table-columns-md)',
    lg: '@max-lg:grid-cols-(--table-columns-lg)',
    xl: '@max-xl:grid-cols-(--table-columns-xl)',
    '2xl': '@max-2xl:grid-cols-(--table-columns-2xl)'
} as const;

const HIDDEN_BELOW = {
    sm: '@max-sm:hidden',
    md: '@max-md:hidden',
    lg: '@max-lg:hidden',
    xl: '@max-xl:hidden',
    '2xl': '@max-2xl:hidden'
} as const;

const ROW_HEIGHT = { regular: 'min-h-10', compact: 'min-h-8' } as const;
const CELL_PADDING = { regular: 'py-2', compact: 'py-1' } as const;
const TEXT_SIZE = { regular: 'text-sm', compact: 'text-xs' } as const;
const ARIA_SORT = { none: 'none', asc: 'ascending', desc: 'descending' } as const;
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3'] as const;

/* Every row is a subgrid of the table, so its cells line up with the columns and it still has a box to tint and focus. */
const ROW = 'col-span-full grid grid-cols-subgrid items-center px-4.5';

/* A click that lands on one of these inside a row is the control's, not the row's. */
const CONTROLS =
    'a[href], button, input, select, textarea, label, [contenteditable="true"], [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"]';

interface TableContextValue {
    columns: readonly TableColumnLayout[];
    density: TableDensity;
    scrolls: boolean;
}

const TableContext = createContext<TableContextValue>({ columns: [], density: 'regular', scrolls: false });
const ColumnIndexContext = createContext(-1);

const templateOf = (columns: readonly TableColumnLayout[]): string => columns.map((column) => column.width).join(' ');

/* Below a breakpoint every column that hides at it or at a wider one is gone. */
const visibleBelow = (columns: readonly TableColumnLayout[], breakpoint: TableBreakpoint): TableColumnLayout[] =>
    columns.filter((column) => column.hideBelow === undefined || BREAKPOINTS.indexOf(column.hideBelow) < BREAKPOINTS.indexOf(breakpoint));

/* A cell knows its column by its place in the row, so cells are the row's direct children. */
const indexed = (children: ReactNode): ReactNode => Children.map(children, (child, index) => <ColumnIndexContext value={index}>{child}</ColumnIndexContext>);

const columnClass = (column: TableColumnLayout | undefined): string =>
    clsx(
        'flex min-w-0 items-center gap-2',
        column?.align === 'end' && 'justify-end text-end tabular-nums',
        column?.hideBelow && HIDDEN_BELOW[column.hideBelow]
    );

function useColumn(): TableColumnLayout | undefined {
    const { columns } = useContext(TableContext);

    return columns[useContext(ColumnIndexContext)];
}

export type TableRootProps = Omit<ComponentProps<'div'>, 'role' | 'aria-label'> & {
    /* The accessible name. */
    label: string;

    columns: readonly TableColumnLayout[];
    density?: TableDensity;

    /* A border with rounded corners around the table. Without it the table is bare, to sit inside a card that already draws one. */
    framed?: boolean;

    /* Pixels the table grows to before its body scrolls under a head that stays. */
    maxHeight?: number;
};

/* A grid rather than a `<table>`, so a cell holds any control and a column can leave on a narrow table. */
export function TableRoot({ label, columns, density = 'regular', framed = false, maxHeight, className, children, ...props }: TableRootProps) {
    const scrolls = maxHeight !== undefined;
    const used = BREAKPOINTS.filter((breakpoint) => columns.some((column) => column.hideBelow === breakpoint));
    const tracks: Record<string, string> = { '--table-columns': templateOf(columns) };

    for (const breakpoint of used) {
        tracks[`--table-columns-${breakpoint}`] = templateOf(visibleBelow(columns, breakpoint));
    }

    const grid = clsx(
        'ade-table-grid grid grid-cols-(--table-columns) gap-x-3',
        used.map((breakpoint) => TEMPLATE_BELOW[breakpoint]),
        TEXT_SIZE[density]
    );

    return (
        <TableContext value={{ columns, density, scrolls }}>
            <div
                role="table"
                aria-label={label}
                {...props}
                className={clsx('@container min-w-0 text-text', framed && 'overflow-clip rounded-lg border border-border bg-surface', className)}
            >
                {scrolls ? (
                    <ScrollArea viewportClassName={grid} style={{ ...tracks, maxHeight } as CSSProperties}>
                        {children}
                    </ScrollArea>
                ) : (
                    <div className={grid} style={tracks as CSSProperties}>
                        {children}
                    </div>
                )}
            </div>
        </TableContext>
    );
}

export type TableHeadProps = useRender.ComponentProps<'div'>;

/* The row of column headers. It stays at the top while the body scrolls, on the surface color. */
export function TableHead({ render, className, ref, children, ...props }: TableHeadProps) {
    const { density, scrolls } = useContext(TableContext);

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'rowgroup',
            ...props,
            className: clsx('ade-table-head col-span-full grid grid-cols-subgrid border-b border-border', scrolls && 'sticky top-0 z-1 bg-surface', className),
            children: (
                <div role="row" className={clsx(ROW, density === 'compact' ? 'min-h-7' : 'min-h-8', 'text-2xs font-medium text-text-muted')}>
                    {indexed(children)}
                </div>
            )
        }
    });
}

export type TableColumnProps = useRender.ComponentProps<'div'> & {
    /* Makes the header a button. The caller sorts the rows. */
    sort?: TableSort;

    /* The direction a click asks for: the other one, or ascending from `none`. */
    onSort?(direction: 'asc' | 'desc'): void;
};

export function TableColumn({ sort, onSort, render, className, ref, children, ...props }: TableColumnProps) {
    const column = useColumn();
    const label = <span className="truncate">{children}</span>;

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'columnheader',
            'aria-sort': sort === undefined ? undefined : ARIA_SORT[sort],
            ...props,
            className: clsx(columnClass(column), 'py-1.5', className),
            children:
                sort === undefined ? (
                    label
                ) : (
                    <button
                        type="button"
                        className="-mx-1 inline-flex min-w-0 items-center gap-1 rounded-sm px-1 hover:text-text"
                        onClick={() => onSort?.(sort === 'asc' ? 'desc' : 'asc')}
                    >
                        {label}
                        <Icon
                            icon={sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ChevronsUpDown}
                            size={12}
                            className={clsx('shrink-0', sort === 'none' && 'text-text-faint')}
                        />
                    </button>
                )
        }
    });
}

export type TableRowProps = useRender.ComponentProps<'div'> & {
    /* Tinted in the accent, for a row a person picked. */
    selected?: boolean;

    /* Muted text, for a row a person reads but cannot change. */
    muted?: boolean;
};

const fromControl = (event: MouseEvent<HTMLElement>): boolean => {
    const row = event.currentTarget;
    const target = event.target;

    // React bubbles a click out of a portal, such as a menu opened from a cell, into the row.
    if (!(target instanceof Element) || !row.contains(target)) {
        return true;
    }

    const control = target.closest(CONTROLS);

    return control !== null && control !== row && row.contains(control);
};

/* With `onClick` the row is a tab stop that Enter and Space press, and a click on a control inside it stays the control's. */
export function TableRow({ selected = false, muted = false, onClick, onKeyDown, render, className, ref, children, ...props }: TableRowProps) {
    const { density } = useContext(TableContext);
    const clickable = onClick !== undefined;

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'row',
            tabIndex: clickable ? 0 : undefined,
            ...props,
            'data-selected': selected ? '' : undefined,
            className: clsx(
                'ade-table-line',
                ROW,
                ROW_HEIGHT[density],
                selected ? 'bg-accent-soft' : clickable && 'hover:bg-surface-hover',
                clickable && 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-on-surface',
                muted && 'text-text-muted',
                className
            ),
            onClick: clickable
                ? (event: MouseEvent<HTMLDivElement>) => {
                      if (!fromControl(event)) {
                          onClick(event);
                      }
                  }
                : undefined,
            onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                onKeyDown?.(event);

                if (!clickable || event.defaultPrevented || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
                    return;
                }

                event.preventDefault();
                event.currentTarget.click();
            },
            children: indexed(children)
        }
    });
}

export type TableCellProps = useRender.ComponentProps<'div'> & {
    /* Text that does not fit ends in an ellipsis; `false` wraps it. Only text truncates: a control or a block of the caller's keeps its own width. */
    truncate?: boolean;

    /* Monospace secondary text, for an id, a path or a hostname. */
    mono?: boolean;
};

const isText = (children: ReactNode): boolean =>
    typeof children === 'string' ||
    typeof children === 'number' ||
    (Array.isArray(children) && children.every((child) => typeof child === 'string' || typeof child === 'number'));

/* Takes its column's alignment and hiding. Any content may sit inside: a pill, a switch, a checkbox, an input or a menu button. */
export function TableCell({ truncate = true, mono = false, render, className, ref, children, ...props }: TableCellProps) {
    const column = useColumn();
    const { density } = useContext(TableContext);

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'cell',
            ...props,
            className: clsx(columnClass(column), CELL_PADDING[density], !truncate && 'flex-wrap', mono && 'font-mono text-code text-text-muted', className),
            children: isText(children) ? <span className={truncate ? 'min-w-0 truncate' : 'min-w-0 break-words'}>{children}</span> : children
        }
    });
}

export type TableGroupProps = useRender.ComponentProps<'div'> & {
    /* The row above the group's rows, spanning every column. */
    label: ReactNode;
};

export function TableGroup({ label, render, className, ref, children, ...props }: TableGroupProps) {
    const { columns } = useContext(TableContext);
    const id = useId();

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'rowgroup',
            'aria-labelledby': id,
            ...props,
            className: clsx('col-span-full grid grid-cols-subgrid', className),
            children: (
                <>
                    <div role="row" className="ade-table-line col-span-full grid min-h-8 grid-cols-subgrid items-end px-4.5 pt-3 pb-1 text-2xs text-text-faint">
                        <div role="cell" id={id} aria-colspan={columns.length} className="col-span-full min-w-0 truncate">
                            {label}
                        </div>
                    </div>
                    {children}
                </>
            )
        }
    });
}

export type TableFootProps = useRender.ComponentProps<'div'>;

/* The totals under the body, behind a stronger line. Its cells follow the columns like a row's. */
export function TableFoot({ render, className, ref, children, ...props }: TableFootProps) {
    const { density } = useContext(TableContext);

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'rowgroup',
            ...props,
            className: clsx('col-span-full grid grid-cols-subgrid border-t border-border font-medium', className),
            children: (
                <div role="row" className={clsx(ROW, ROW_HEIGHT[density])}>
                    {indexed(children)}
                </div>
            )
        }
    });
}

export type TableEmptyProps = useRender.ComponentProps<'div'>;

/* The one row of a table without rows, its message across every column. */
export function TableEmpty({ render, className, ref, children, ...props }: TableEmptyProps) {
    const { columns } = useContext(TableContext);

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'row',
            ...props,
            className: clsx('ade-table-line', ROW, className),
            children: (
                <div role="cell" aria-colspan={columns.length} className="col-span-full min-w-0 py-6 text-center break-words text-text-muted">
                    {children}
                </div>
            )
        }
    });
}

export interface TableLoadingProps {
    /* How many rows of bars stand in for the rows on their way. */
    rows?: number;

    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* Rows of bars under the columns; a screen reader hears that the table is loading instead. */
export function TableLoading({ rows = 3, className, ref }: TableLoadingProps) {
    const { t } = useTranslation('ui');
    const { columns } = useContext(TableContext);

    return (
        <div ref={ref} role="rowgroup" aria-busy aria-label={t('table.loading')} className={clsx('col-span-full grid grid-cols-subgrid', className)}>
            {Array.from({ length: rows }, (_, row) => (
                <TableRow key={row} aria-hidden>
                    {Array.from(columns, (_, index) => (
                        <TableCell key={index}>
                            <Skeleton className={SKELETON_WIDTHS[(row + index) % SKELETON_WIDTHS.length]} />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </div>
    );
}
