import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { FileTree, FileTreeVisibleRow } from '@pierre/trees';
import type { LucideIcon } from 'lucide-react';
import { directoryOfEmptyLine, isEmptyLine, type FileTreeEmptyLabel } from './empty-lines.ts';
import { pathOfRow, visibleRows, visibleRowsAround } from './helpers.ts';
import { matchHighlight, rangesOfMatches } from './highlight.ts';
import { FILE_TREE_CSS } from './style.ts';

export interface RowSlot {
    row: FileTreeVisibleRow;
    control: HTMLElement;
    decoration: HTMLElement;
    /* Where a row's own icon goes in place of the engine's glyph; null when the row keeps that glyph. */
    icon: HTMLElement | null;
}

export interface Port {
    rowElement: HTMLElement;
    control: HTMLElement;
    decoration: HTMLElement;
    lightControl: HTMLElement;
    lightDecoration: HTMLElement;
    icon?: HTMLElement;
    lightIcon?: HTMLElement;
    unhover?(): void;
}

export type FileTreeRowIcon = (row: FileTreeVisibleRow) => LucideIcon | undefined;

/*
 * Read from the spacer beta.6 puts above the mounted window, so a scroll frame copies those rows and not
 * every visible one. The whole list stands in when the spacer is missing or the model moved past it.
 */
function mountedRows(model: FileTree, shadow: ShadowRoot, elements: readonly HTMLElement[]): FileTreeVisibleRow[] {
    const spacer = shadow.querySelector<HTMLElement>('[data-file-tree-virtualized-sticky-offset]');
    const offset = spacer === null ? Number.NaN : Number.parseFloat(spacer.style.height);
    const itemHeight = model.getItemHeight();
    if (!Number.isFinite(offset) || itemHeight <= 0) {
        return visibleRows(model);
    }
    // A folder pinned to the top leaves the flow, but still takes its index in the window.
    const pinned = shadow.querySelectorAll('[data-file-tree-sticky-row="true"]').length;
    const rows = visibleRowsAround(model, Math.round(offset / itemHeight), elements.length + pinned);
    const paths = new Set(rows.map((row) => row.path));
    return elements.every((element) => element.dataset.itemPath === undefined || paths.has(element.dataset.itemPath)) ? rows : visibleRows(model);
}

/* Relative to the engine's git status column. */
export type FileTreeDecorationOrder = 'before-status' | 'after-status';

/* Every size first, then the spaces, then every offset, then the ports, so a pass forces two layouts at most. */
export function positionPorts(ports: Iterable<Port>, order: FileTreeDecorationOrder = 'before-status'): void {
    const spaced = [...ports].map((port) => ({
        port,
        // Without a git column, after the column is right after the name.
        status: order === 'after-status' ? port.rowElement.querySelector<HTMLElement>('[data-item-section="git"]') : null,
        control: port.lightControl.childNodes.length > 0 ? Math.ceil(port.lightControl.getBoundingClientRect().width) + 6 : 0,
        decoration: port.lightDecoration.childNodes.length > 0 ? Math.ceil(port.lightDecoration.getBoundingClientRect().width) + 6 : 0
    }));
    for (const { port, status, control, decoration } of spaced) {
        setSpace(port.rowElement, '--adecore-tree-control-space', control);
        setSpace(port.rowElement, '--adecore-tree-decoration-space', status === null ? decoration : 0);
        setSpace(port.rowElement, '--adecore-tree-status-space', status === null ? 0 : decoration);
    }
    const placed = spaced.map(({ port, status, control, decoration }) => {
        const row = port.rowElement;
        const before = status ?? row.querySelector<HTMLElement>('[data-item-section="content"]');
        const icon = row.querySelector<HTMLElement>('[data-item-section="icon"]');
        const iconLeft = row.offsetLeft + (icon?.offsetLeft ?? 4);
        return {
            port,
            top: `${row.offsetTop}px`,
            iconLeft: `${iconLeft}px`,
            controlLeft: `${iconLeft - control}px`,
            decorationLeft: `${row.offsetLeft + (before === null ? row.offsetWidth - decoration - 2 : before.offsetLeft + before.offsetWidth + 6)}px`
        };
    });
    for (const { port, top, iconLeft, controlLeft, decorationLeft } of placed) {
        port.control.style.top = top;
        port.control.style.left = controlLeft;
        port.decoration.style.top = top;
        port.decoration.style.left = decorationLeft;
        if (port.icon !== undefined) {
            port.icon.style.top = top;
            port.icon.style.left = iconLeft;
        }
    }
}

// An unchanged space is left alone, so a pass that only scrolled measures once.
function setSpace(row: HTMLElement, name: string, space: number): void {
    const value = `${space}px`;
    if (row.style.getPropertyValue(name) !== value) {
        row.style.setProperty(name, value);
    }
}

export interface FileTreeSlotOptions {
    order: FileTreeDecorationOrder;
    rowIcon?: FileTreeRowIcon;
    /* Empty marks nothing. */
    highlight: string;
    emptyLabel?: FileTreeEmptyLabel;
}

/* An empty line draws its directory's label in place of its name and is no item to point at or read out. */
function markEmptyLine(element: HTMLElement, label: string): void {
    element.dataset.emptyLine = 'true';
    element.dataset.interactive = 'false';
    element.setAttribute('aria-hidden', 'true');
    const content = element.querySelector<HTMLElement>('[data-item-section="content"]');
    if (content !== null && content.dataset.emptyLabel !== label) {
        content.dataset.emptyLabel = label;
    }
}

// The engine recycles row elements, so one that drew a line can come back as an ordinary row.
function unmarkEmptyLine(element: HTMLElement): void {
    if (element.dataset.emptyLine === undefined) {
        return;
    }
    delete element.dataset.emptyLine;
    element.removeAttribute('aria-hidden');
    const content = element.querySelector<HTMLElement>('[data-item-section="content"]');
    if (content !== null) {
        delete content.dataset.emptyLabel;
    }
}

// beta.6 owns button rows. Sibling slots keep real controls outside those buttons and in the app's stylesheet.
export function useFileTreeSlots(model: FileTree, frame: HTMLElement | null, label: string, { order, rowIcon, highlight, emptyLabel }: FileTreeSlotOptions) {
    const prefix = useId().replaceAll(':', '');
    const [slots, setSlots] = useState<RowSlot[]>([]);
    const latestIcon = useRef(rowIcon);
    const latestHighlight = useRef(highlight);
    const latestEmpty = useRef(emptyLabel);
    const rescan = useRef<(() => void) | undefined>(undefined);

    useLayoutEffect(() => {
        latestIcon.current = rowIcon;
        latestHighlight.current = highlight;
        latestEmpty.current = emptyLabel;
        rescan.current?.();
    }, [rowIcon, highlight, emptyLabel]);

    useEffect(() => {
        if (frame === null) {
            return;
        }
        const ports = new Map<HTMLElement, Port>();
        let shadow: ShadowRoot | null = null;
        let style: HTMLStyleElement | null = null;
        let serial = 0;
        let disposed = false;
        let pending = false;
        let snapshot: string | null = null;
        let marked: Range[] = [];

        const mark = (rows: readonly HTMLElement[], query: string): void => {
            const matches = matchHighlight();
            if (matches === null) {
                return;
            }
            for (const range of marked) {
                matches.delete(range);
            }
            marked = rangesOfMatches(rows, query);
            for (const range of marked) {
                matches.add(range);
            }
        };

        const position = (): void => positionPorts(ports.values(), order);

        const resize = new ResizeObserver(position);
        const dropPort = (port: Port): void => {
            port.control.remove();
            port.decoration.remove();
            resize.unobserve(port.lightControl);
            resize.unobserve(port.lightDecoration);
            port.lightControl.remove();
            port.lightDecoration.remove();
            dropIcon(port);
        };
        const clearPort = (port: Port): void => {
            for (const name of ['--adecore-tree-control-space', '--adecore-tree-decoration-space', '--adecore-tree-status-space']) {
                port.rowElement.style.removeProperty(name);
            }
            delete port.rowElement.dataset.ownIcon;
            dropPort(port);
        };
        const dropIcon = (port: Port): void => {
            port.unhover?.();
            port.icon?.remove();
            port.lightIcon?.remove();
            port.icon = undefined;
            port.lightIcon = undefined;
            port.unhover = undefined;
        };
        // The icon lets every pointer event through to the row under it, which then opens, folds or selects as it would.
        const makeIcon = (port: Port, host: HTMLElement): void => {
            const container = document.createElement('span');
            container.dataset.treePort = 'icon';
            container.dataset.itemPath = port.rowElement.dataset.itemPath;
            const slot = document.createElement('slot');
            slot.name = `${prefix}-icon-${serial++}`;
            container.append(slot);
            port.rowElement.parentElement?.append(container);
            const target = document.createElement('span');
            target.slot = slot.name;
            target.className = 'adecore-tree-icon';
            host.append(target);
            // A folder under the pointer gives its chevron back, so the row still says it opens.
            const show = (): void => {
                if (port.rowElement.dataset.itemType === 'folder') {
                    container.dataset.hover = 'true';
                }
            };
            const hide = (): void => {
                delete container.dataset.hover;
            };
            port.rowElement.addEventListener('pointerenter', show);
            port.rowElement.addEventListener('pointerleave', hide);
            port.icon = container;
            port.lightIcon = target;
            port.unhover = () => {
                port.rowElement.removeEventListener('pointerenter', show);
                port.rowElement.removeEventListener('pointerleave', hide);
            };
        };
        const makePort = (element: HTMLElement, host: HTMLElement, kind: 'control' | 'decoration'): { container: HTMLElement; target: HTMLElement } => {
            const container = document.createElement('span');
            container.dataset.treePort = kind;
            const slot = document.createElement('slot');
            slot.name = `${prefix}-${kind}-${serial}`;
            container.append(slot);
            element.parentElement?.append(container);
            const target = document.createElement('span');
            target.slot = slot.name;
            target.dataset.treeSlot = kind;
            target.className = kind === 'control' ? 'adecore-tree-control' : 'adecore-tree-decoration';
            // React delegates to this portal target before the event reaches the engine's shadow tree.
            for (const type of ['click', 'dblclick', 'keydown', 'keyup', 'pointerdown', 'dragstart']) {
                target.addEventListener(type, (event) => event.stopPropagation());
            }
            host.append(target);
            resize.observe(target);
            return { container, target };
        };
        const scan = (): void => {
            pending = false;
            if (disposed) {
                return;
            }
            const current = model.getFileTreeContainer();
            if (!current?.shadowRoot) {
                return;
            }
            if (shadow !== current.shadowRoot) {
                shadow = current.shadowRoot;
                style = document.createElement('style');
                style.dataset.adecoreTreeStyle = 'true';
                style.textContent = FILE_TREE_CSS;
                shadow.append(style);
                changes.observe(shadow, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['data-item-path', 'aria-selected', 'aria-expanded']
                });
                changes.observe(current, { childList: true, subtree: true });
                resize.observe(current);
            }
            shadow.querySelector('[role="tree"]')?.setAttribute('aria-label', label);
            const elements = [
                ...shadow.querySelectorAll<HTMLElement>('[data-type="item"]:not([data-item-parked="true"]):not([data-file-tree-sticky-row="true"])')
            ];
            const rows = mountedRows(model, shadow, elements);
            const byPath = new Map(rows.map((row) => [pathOfRow(row), row]));
            const byIndex = new Map(rows.map((row) => [row.index, row]));
            const live = new Set(elements);
            for (const [element, port] of ports) {
                if (!live.has(element)) {
                    dropPort(port);
                    ports.delete(element);
                }
            }
            const next: RowSlot[] = [];
            const named: HTMLElement[] = [];
            for (const element of elements) {
                const path = element.dataset.itemPath;
                const row = path === undefined ? undefined : byPath.get(path);
                if (row === undefined) {
                    continue;
                }
                if (isEmptyLine(row.path)) {
                    const recycled = ports.get(element);
                    if (recycled !== undefined) {
                        clearPort(recycled);
                        ports.delete(element);
                    }
                    const directory = byPath.get(directoryOfEmptyLine(row.path));
                    markEmptyLine(element, (directory === undefined ? undefined : latestEmpty.current?.(directory)) ?? '');
                    continue;
                }
                unmarkEmptyLine(element);
                named.push(element);
                element.dataset.interactive = 'true';
                element.dataset.joinedStart = String(row.isSelected && byIndex.get(row.index - 1)?.isSelected === true);
                element.dataset.joinedEnd = String(row.isSelected && byIndex.get(row.index + 1)?.isSelected === true);
                let port = ports.get(element);
                if (port === undefined) {
                    serial++;
                    const control = makePort(element, current, 'control');
                    const decoration = makePort(element, current, 'decoration');
                    port = {
                        rowElement: element,
                        control: control.container,
                        decoration: decoration.container,
                        lightControl: control.target,
                        lightDecoration: decoration.target
                    };
                    ports.set(element, port);
                }
                if (port.control.dataset.itemPath !== row.path) {
                    port.control.dataset.itemPath = row.path;
                }
                if (port.decoration.dataset.itemPath !== row.path) {
                    port.decoration.dataset.itemPath = row.path;
                }
                port.lightControl.dataset.itemPath = row.path;
                port.lightDecoration.dataset.itemPath = row.path;
                const ownIcon = latestIcon.current?.(row) !== undefined;
                if (ownIcon && port.icon === undefined) {
                    makeIcon(port, current);
                } else if (!ownIcon && port.icon !== undefined) {
                    dropIcon(port);
                }
                if (port.icon !== undefined && port.icon.dataset.itemPath !== row.path) {
                    port.icon.dataset.itemPath = row.path;
                }
                if (ownIcon) {
                    element.dataset.ownIcon = 'true';
                } else if (element.dataset.ownIcon !== undefined) {
                    delete element.dataset.ownIcon;
                }
                next.push({ row, control: port.lightControl, decoration: port.lightDecoration, icon: port.lightIcon ?? null });
            }
            const key = next
                .map(
                    ({ row, control, icon }) =>
                        `${control.slot}:${row.path}:${row.isSelected}:${row.isExpanded}:${row.isFocused}:${row.name}:${icon?.slot ?? ''}`
                )
                .join('|');
            if (snapshot !== key) {
                snapshot = key;
                // Recycled rows must paint with their new portal contents in the same frame.
                flushSync(() => setSlots(next));
            }
            mark(named, latestHighlight.current);
            position();
        };
        const schedule = (): void => {
            if (!pending && !disposed) {
                pending = true;
                queueMicrotask(scan);
            }
        };
        rescan.current = schedule;
        const shifts = new MutationObserver(position);
        shifts.observe(frame, { attributes: true, attributeFilter: ['style'] });
        const changes = new MutationObserver(schedule);
        changes.observe(frame, { childList: true, subtree: true });
        const unsubscribe = model.subscribe(schedule);
        schedule();
        return () => {
            disposed = true;
            rescan.current = undefined;
            unsubscribe();
            changes.disconnect();
            shifts.disconnect();
            resize.disconnect();
            style?.remove();
            mark([], '');
            for (const port of ports.values()) {
                clearPort(port);
            }
        };
    }, [frame, model, label, order, prefix]);

    return slots;
}
