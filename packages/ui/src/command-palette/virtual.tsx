import { Fragment, useLayoutEffect, useMemo, useRef, type ComponentProps, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { CommandPaletteList } from './parts.tsx';
import { useCommandPaletteVirtualScroll } from './context.ts';
import { MENU_LABEL } from '../menu/parts.tsx';
import { mergeRefs } from '../merge-refs.ts';

export interface CommandPaletteVirtualItemProps {
    index: number;
    'aria-setsize': number;
    'aria-posinset': number;
}

export type CommandPaletteVirtualListProps<ItemValue, Group extends { items: readonly ItemValue[] } = { items: readonly ItemValue[] }> = Omit<
    ComponentProps<typeof CommandPaletteList>,
    'children'
> & {
    children(item: ItemValue, props: CommandPaletteVirtualItemProps): ReactNode;
    groupLabel?(group: Group): ReactNode;
};

interface VirtualPaletteRow<ItemValue> {
    group: number;
    index: number;
    item?: ItemValue;
}

function virtualRowsOf<ItemValue, Group extends { items: readonly ItemValue[] }>(values: readonly (ItemValue | Group)[], labelled: boolean) {
    const groups: (Group | null)[] = [];
    const rows: VirtualPaletteRow<ItemValue>[] = [];
    const itemRows: number[] = [];
    let count = 0;

    for (const value of values) {
        const grouped = value !== null && typeof value === 'object' && 'items' in value && Array.isArray(value.items);
        const group = grouped ? (value as Group) : null;

        if (group !== null && group.items.length === 0) {
            continue;
        }

        const groupIndex = groups.length;
        groups.push(group);

        if (group !== null && labelled) {
            rows.push({ group: groupIndex, index: -1 });
        }

        for (const item of group === null ? [value as ItemValue] : group.items) {
            itemRows.push(rows.length);
            rows.push({ group: groupIndex, index: count++, item });
        }
    }

    return { groups, rows, itemRows, count };
}

/* The root retains every value for keyboard navigation; only the visible rows need DOM elements. */
export function CommandPaletteVirtualList<ItemValue, Group extends { items: readonly ItemValue[] } = { items: readonly ItemValue[] }>({
    children,
    groupLabel,
    ref,
    ...props
}: CommandPaletteVirtualListProps<ItemValue, Group>) {
    // The virtualizer keeps a mutable handle; every render reads its current window.
    'use no memo';
    const scroll = useCommandPaletteVirtualScroll();
    const filtered = Autocomplete.useFilteredItems<ItemValue | Group>();
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const labelled = groupLabel !== undefined;
    const { groups, rows, itemRows, count } = useMemo(() => virtualRowsOf<ItemValue, Group>(filtered, labelled), [filtered, labelled]);

    // oxlint-disable-next-line react/incompatible-library
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: (index) => (rows[index]!.index === -1 ? 28 : 32),
        overscan: 8,
        initialRect: { width: 576, height: 320 },
        scrollPaddingStart: 6,
        scrollPaddingEnd: 6
    });

    useLayoutEffect(() => {
        if (scroll === null) {
            return;
        }

        const highlight = (index: number, reason: string): void => {
            const row = itemRows[index];

            if (row !== undefined && reason !== 'pointer') {
                virtualizer.scrollToIndex(row, { align: reason === 'none' ? 'start' : 'auto' });
            }
        };

        scroll.current = highlight;

        return () => {
            if (scroll.current === highlight) {
                scroll.current = null;
            }
        };
    }, [scroll, virtualizer, itemRows]);

    const visible = virtualizer.getVirtualItems();
    const visibleGroups = new Map<number, typeof visible>();

    for (const item of visible) {
        const group = rows[item.index]!.group;
        const current = visibleGroups.get(group);

        if (current === undefined) {
            visibleGroups.set(group, [item]);
        } else {
            current.push(item);
        }
    }

    const renderRows = (items: typeof visible): ReactNode =>
        items.map((item) => {
            const row = rows[item.index]!;
            const group = groups[row.group];

            return (
                <div
                    key={item.key}
                    role="presentation"
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{ transform: `translateY(${item.start}px)` }}
                >
                    {row.index === -1 && group !== null && group !== undefined ? (
                        <Autocomplete.GroupLabel className={MENU_LABEL}>{groupLabel?.(group)}</Autocomplete.GroupLabel>
                    ) : (
                        children(row.item as ItemValue, { index: row.index, 'aria-posinset': row.index + 1, 'aria-setsize': count })
                    )}
                </div>
            );
        });

    return (
        <CommandPaletteList {...props} ref={mergeRefs(ref, scrollRef)}>
            <div role="presentation" className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {[...visibleGroups].map(([index, items]) => {
                    const group = groups[index];

                    if (group === null || group === undefined) {
                        return <Fragment key={index}>{renderRows(items)}</Fragment>;
                    }

                    const labelVisible = items.some((item) => rows[item.index]!.index === -1);

                    return (
                        <Autocomplete.Group key={index} items={group.items}>
                            {!labelVisible && groupLabel !== undefined && (
                                <Autocomplete.GroupLabel className="sr-only">{groupLabel(group)}</Autocomplete.GroupLabel>
                            )}
                            {renderRows(items)}
                        </Autocomplete.Group>
                    );
                })}
            </div>
        </CommandPaletteList>
    );
}
