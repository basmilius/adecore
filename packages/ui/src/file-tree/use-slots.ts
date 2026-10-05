import { useEffect, useId, useState } from 'react';
import type { FileTree, FileTreeVisibleRow } from '@pierre/trees';
import { pathOfRow, visibleRows } from './helpers.ts';
import { FILE_TREE_CSS } from './style.ts';

export interface RowSlot {
    row: FileTreeVisibleRow;
    control: HTMLElement;
    decoration: HTMLElement;
}

interface Port {
    rowElement: HTMLElement;
    control: HTMLElement;
    decoration: HTMLElement;
    lightControl: HTMLElement;
    lightDecoration: HTMLElement;
}

// beta.6 owns button rows. Sibling slots keep real controls outside those buttons and in the app's stylesheet.
export function useFileTreeSlots(model: FileTree, frame: HTMLElement | null, label: string) {
    const prefix = useId().replaceAll(':', '');
    const [slots, setSlots] = useState<RowSlot[]>([]);

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

        const position = (): void => {
            for (const port of ports.values()) {
                const row = port.rowElement;
                const content = row.querySelector<HTMLElement>('[data-item-section="content"]');
                const icon = row.querySelector<HTMLElement>('[data-item-section="icon"]');
                const control = port.lightControl;
                const decoration = port.lightDecoration;
                const controlSpace = control.childNodes.length > 0 ? Math.ceil(control.getBoundingClientRect().width) + 6 : 0;
                const decorationSpace = decoration.childNodes.length > 0 ? Math.ceil(decoration.getBoundingClientRect().width) + 6 : 0;
                row.style.setProperty('--adecore-tree-control-space', `${controlSpace}px`);
                row.style.setProperty('--adecore-tree-decoration-space', `${decorationSpace}px`);
                port.control.style.top = `${row.offsetTop}px`;
                port.control.style.left = `${row.offsetLeft + (icon?.offsetLeft ?? 4) - controlSpace}px`;
                port.decoration.style.top = `${row.offsetTop}px`;
                port.decoration.style.left = `${row.offsetLeft + (content === null ? row.offsetWidth - decorationSpace - 2 : content.offsetLeft + content.offsetWidth + 6)}px`;
            }
        };

        const resize = new ResizeObserver(position);
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
            const rows = visibleRows(model);
            const byPath = new Map(rows.map((row) => [pathOfRow(row), row]));
            const elements = [
                ...shadow.querySelectorAll<HTMLElement>('[data-type="item"]:not([data-item-parked="true"]):not([data-file-tree-sticky-row="true"])')
            ];
            const live = new Set(elements);
            for (const [element, port] of ports) {
                if (!live.has(element)) {
                    port.control.remove();
                    port.decoration.remove();
                    resize.unobserve(port.lightControl);
                    resize.unobserve(port.lightDecoration);
                    port.lightControl.remove();
                    port.lightDecoration.remove();
                    ports.delete(element);
                }
            }
            const next: RowSlot[] = [];
            for (const element of elements) {
                const path = element.dataset.itemPath;
                const row = path === undefined ? undefined : byPath.get(path);
                if (row === undefined) {
                    continue;
                }
                element.dataset.interactive = 'true';
                element.dataset.joinedStart = String(row.isSelected && rows[row.index - 1]?.isSelected === true);
                element.dataset.joinedEnd = String(row.isSelected && rows[row.index + 1]?.isSelected === true);
                let port = ports.get(element);
                if (port === undefined) {
                    const makePort = (kind: string): { container: HTMLElement; target: HTMLElement } => {
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
                        current.append(target);
                        resize.observe(target);
                        return { container, target };
                    };
                    serial++;
                    const control = makePort('control');
                    const decoration = makePort('decoration');
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
                next.push({ row, control: port.lightControl, decoration: port.lightDecoration });
            }
            const key = next
                .map(({ row, control }) => `${control.slot}:${row.path}:${row.isSelected}:${row.isExpanded}:${row.isFocused}:${row.name}`)
                .join('|');
            if (snapshot !== key) {
                snapshot = key;
                setSlots(next);
            }
            position();
        };
        const schedule = (): void => {
            if (!pending && !disposed) {
                pending = true;
                queueMicrotask(scan);
            }
        };
        const shifts = new MutationObserver(position);
        shifts.observe(frame, { attributes: true, attributeFilter: ['style'] });
        const changes = new MutationObserver(schedule);
        changes.observe(frame, { childList: true, subtree: true });
        const unsubscribe = model.subscribe(schedule);
        schedule();
        return () => {
            disposed = true;
            unsubscribe();
            changes.disconnect();
            shifts.disconnect();
            resize.disconnect();
            style?.remove();
            for (const port of ports.values()) {
                port.rowElement.style.removeProperty('--adecore-tree-control-space');
                port.rowElement.style.removeProperty('--adecore-tree-decoration-space');
                port.control.remove();
                port.decoration.remove();
                port.lightControl.remove();
                port.lightDecoration.remove();
            }
        };
    }, [frame, model, label, prefix]);

    return slots;
}
