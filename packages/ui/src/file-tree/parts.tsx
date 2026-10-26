import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRender } from '@base-ui/react/use-render';
import { FileTree as PierreFileTree, type FileTreeProps as PierreProps } from '@pierre/trees/react';
import type { FileTree, FileTreeVisibleRow } from '@pierre/trees';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from '../Icon.tsx';
import { mergeRefs } from '../merge-refs.ts';
import { directoryHandle, extendsSelection, followFocus, movesFocus, menuTargetsOf, rowPathOf, visibleRows } from './helpers.ts';
import type { FileTreeEmptyLabel } from './empty-lines.ts';
import { useEmptyLines } from './use-empty-lines.ts';
import { useFileTreeShift } from './use-file-tree-shift.tsx';
import { useFileTreeSlots, type FileTreeDecorationOrder } from './use-slots.ts';

export type FileTreeRootProps = useRender.ComponentProps<'div'> & {
    model: FileTree;
    label?: string;
    resetKey?: string;
    selectionFollowsFocus?: boolean;
    onActivate?(path: string): void;
    onFocusMove?(path: string): void;
    onLoadChildren?(path: string): void;
    onRowContextMenu?(path: string, targets: readonly string[], event: MouseEvent): void;
    onRowDragStart?(path: string, targets: readonly string[], event: DragEvent): void;
    onExpandedPathsChange?(paths: readonly string[]): void;
    renderControl?(row: FileTreeVisibleRow): ReactNode;
    renderDecoration?(row: FileTreeVisibleRow): ReactNode;
    decorationOrder?: FileTreeDecorationOrder;

    /* In place of the row's own glyph (the file icon, or a directory's chevron); undefined keeps that glyph. */
    rowIcon?(row: FileTreeVisibleRow): LucideIcon | undefined;

    /* As tall as its rows, up to the height its container leaves it. */
    fitContent?: boolean;

    /* Marks where this occurs in every name, ignoring case. */
    highlight?: string;

    /* The line under an open, empty directory; undefined draws none, such as while its children still load. */
    emptyLabel?: FileTreeEmptyLabel;

    treeProps?: Omit<PierreProps, 'model'>;
};

function inSlot(event: Event): boolean {
    return event.composedPath().some((node) => node instanceof HTMLElement && node.hasAttribute('data-tree-slot'));
}

export function FileTreeRoot({
    model,
    label,
    resetKey,
    selectionFollowsFocus = true,
    onActivate,
    onFocusMove,
    onLoadChildren,
    onExpandedPathsChange,
    onRowContextMenu,
    onRowDragStart,
    renderControl,
    renderDecoration,
    decorationOrder = 'before-status',
    rowIcon,
    fitContent = false,
    highlight = '',
    emptyLabel,
    treeProps,
    render,
    className,
    ref,
    children,
    onClick,
    onKeyDownCapture,
    style,
    ...props
}: FileTreeRootProps) {
    const { t } = useTranslation('ui');
    const [frame, setFrame] = useState<HTMLDivElement | null>(null);
    const { attach, bar } = useFileTreeShift(model, resetKey);

    const frameRef = (node: Element | null) => {
        setFrame(node as HTMLDivElement | null);
        attach(node as HTMLElement | null);
        mergeRefs<Element>(ref)(node);
    };

    const subscribeToRows = (listener: () => void): (() => void) => (fitContent ? model.subscribe(listener) : () => {});

    const countRows = (): number => model.getVisibleCount();

    const rowCount = useSyncExternalStore(subscribeToRows, countRows, countRows);
    const slots = useFileTreeSlots(model, frame, label ?? t('tree.label'), { order: decorationOrder, rowIcon, highlight, emptyLabel });
    const passEmptyLine = useEmptyLines(model, frame, emptyLabel);
    const latestLoads = useRef({ onLoadChildren, onExpandedPathsChange });

    useLayoutEffect(() => {
        latestLoads.current = { onLoadChildren, onExpandedPathsChange };
    }, [onLoadChildren, onExpandedPathsChange]);

    const cancelFocus = useRef<(() => void) | undefined>(undefined);

    useEffect(() => () => cancelFocus.current?.(), [model]);

    useEffect(() => {
        let previous = new Set<string>();
        let disposed = false;
        let pending = false;

        const report = (): void => {
            pending = false;

            if (disposed) {
                return;
            }

            const rows = visibleRows(model).filter((row) => row.kind === 'directory');
            const known = new Set(rows.map((row) => row.path));
            const expanded = new Set([...previous].filter((path) => !known.has(path)));

            for (const row of rows) {
                if (row.isExpanded) {
                    expanded.add(row.path);
                }
            }

            const opened = [...expanded].filter((path) => !previous.has(path));
            const changed = opened.length > 0 || [...previous].some((path) => !expanded.has(path));
            previous = expanded;

            if (changed) {
                latestLoads.current.onExpandedPathsChange?.([...expanded]);
            }

            for (const path of opened) {
                latestLoads.current.onLoadChildren?.(path);
            }
        };

        const schedule = (): void => {
            if (!pending) {
                pending = true;
                queueMicrotask(report);
            }
        };

        const unsubscribe = model.subscribe(schedule);
        report();

        return () => {
            disposed = true;
            unsubscribe();
        };
    }, [model]);

    useEffect(() => {
        if (frame === null) {
            return;
        }

        const onClickRow = (event: MouseEvent): void => {
            if (event.defaultPrevented || inSlot(event) || extendsSelection(event)) {
                return;
            }

            const path = rowPathOf({ nativeEvent: event });

            if (path !== null && directoryHandle(model, path) === null) {
                onActivate?.(path);
            }
        };

        const onKey = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || inSlot(event)) {
                return;
            }

            if (movesFocus(event) && selectionFollowsFocus) {
                cancelFocus.current?.();
                // beta.6 stops the key in its own handler; selection must follow after that handler moves focus.
                cancelFocus.current = followFocus(model, onFocusMove);
            }

            passEmptyLine(event);

            if (event.key === 'Enter' && !event.altKey && !event.metaKey && !event.ctrlKey) {
                const path = model.getFocusedPath();

                if (path === null) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                const directory = directoryHandle(model, path);

                if (directory) {
                    directory.toggle();
                } else {
                    onActivate?.(path);
                }
            }
        };

        const withTargets =
            <RowEvent extends Event>(handle?: (path: string, targets: readonly string[], event: RowEvent) => void) =>
            (event: RowEvent): void => {
                if (inSlot(event)) {
                    return;
                }

                const path = rowPathOf({ nativeEvent: event });

                if (path !== null) {
                    handle?.(path, menuTargetsOf(path, model.getSelectedPaths()), event);
                }
            };

        const onContext = withTargets(onRowContextMenu);
        const onDrag = withTargets(onRowDragStart);
        frame.addEventListener('click', onClickRow);
        frame.addEventListener('keydown', onKey, true);
        frame.addEventListener('contextmenu', onContext);
        frame.addEventListener('dragstart', onDrag);

        return () => {
            frame.removeEventListener('click', onClickRow);
            frame.removeEventListener('keydown', onKey, true);
            frame.removeEventListener('contextmenu', onContext);
            frame.removeEventListener('dragstart', onDrag);
        };
    }, [frame, model, selectionFollowsFocus, passEmptyLine, onActivate, onFocusMove, onRowContextMenu, onRowDragStart]);

    return useRender({
        render,
        ref: frameRef,
        defaultTagName: 'div',
        props: {
            ...props,
            className: clsx('adecore-tree adecore-file-tree', className),
            style: fitContent ? { ...style, height: rowCount * model.getItemHeight(), maxHeight: '100%' } : style,
            onClick,
            onKeyDownCapture,
            children: (
                <>
                    <PierreFileTree {...treeProps} model={model} className={clsx('adecore-file-tree-host', treeProps?.className)} />
                    {slots.map(({ row, control, decoration, icon }) => {
                        const ownIcon = icon === null ? undefined : rowIcon?.(row);

                        return (
                            <span key={control.slot} style={{ display: 'contents' }}>
                                {createPortal(renderControl?.(row), control)}
                                {createPortal(renderDecoration?.(row), decoration)}
                                {icon !== null && ownIcon !== undefined && createPortal(<Icon icon={ownIcon} size={14} />, icon)}
                            </span>
                        );
                    })}
                    {children}
                    {bar}
                </>
            )
        }
    });
}
