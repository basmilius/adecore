import clsx from 'clsx';
import { MoreHorizontal } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type DragEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CloseButton } from '../CloseButton.tsx';
import * as ContextMenu from '../context-menu/index.parts.ts';
import { IconButton } from '../IconButton.tsx';
import * as Popover from '../popover/index.parts.ts';
import { Separator } from '../Separator.tsx';
import type { Shortcut } from '../shortcut.ts';

/* What the bar holds that is not the bar: a press on one of these is not the start of a drag. */
const CONTROLS = 'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="button"]';

/* Without this margin, a bar right at the fold point would fold and unfold on every pixel of a splitter drag. */
const UNFOLD_MARGIN = 24;

/* Two controls and an overflow menu stand at the end of a strip of tabs; more get a bar of their own under it. */
const CONTROLS_BESIDE_TABS = 3;

/* The controls a person can reach, not counting one inside another, such as the button of a field. */
function countControls(element: HTMLElement): number {
    return Array.from(element.querySelectorAll(CONTROLS)).filter((control) => {
        const outer = control.parentElement?.closest(CONTROLS);

        return outer === null || outer === undefined || !element.contains(outer);
    }).length;
}

/*
 * Whether what a pane with tabs brings fits beside its tabs. Counted again whenever it changes, as when
 * the tab in front portals other controls in, wherever it stands at the time.
 */
function useBesideTabs(part: RefObject<HTMLElement | null>, enabled: boolean): boolean {
    const [beside, setBeside] = useState(true);

    useLayoutEffect(() => {
        const element = part.current;

        if (!enabled || element === null || typeof MutationObserver === 'undefined') {
            return;
        }

        const measure = (): void => setBeside(countControls(element) <= CONTROLS_BESIDE_TABS);
        const observer = new MutationObserver(measure);

        observer.observe(element, { childList: true, subtree: true });
        measure();

        return () => observer.disconnect();
        // Again on every move: the part is a new element in its new place.
    }, [part, enabled, beside]);

    return beside;
}

/*
 * Whether the actions are folded into the overflow menu: only once the title has shrunk to its glyph and
 * the actions still do not fit. The width where that happened is remembered, since a folded bar fits by
 * definition and can no longer tell by overflowing when there is room again.
 */
function useFolded(bar: RefObject<HTMLElement | null>, actions: RefObject<HTMLElement | null>, enabled: boolean): boolean {
    const [foldedAt, setFoldedAt] = useState<number | null>(null);

    useEffect(() => {
        const element = bar.current;

        if (!enabled || element === null || typeof ResizeObserver === 'undefined') {
            return;
        }

        const measure = (): void => {
            const width = element.clientWidth;

            setFoldedAt((current) => {
                if (current !== null) {
                    return width > current + UNFOLD_MARGIN ? null : current;
                }

                return element.scrollWidth > width + 1 ? width : null;
            });
        };

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        // The actions change size on their own as well, as when a terminal's agent adds its mode.
        if (actions.current) {
            observer.observe(actions.current);
        }

        measure();

        return () => observer.disconnect();
        // Again on every fold: the actions are a new element each time they come back.
    }, [bar, actions, enabled, foldedAt]);

    // A pane that brings no actions has nothing to fold, whatever the bar measured before it changed.
    return enabled && foldedAt !== null;
}

function hasNode(node: ReactNode): boolean {
    return node !== undefined && node !== null && node !== false;
}

export interface PaneBarProps extends Omit<ComponentProps<'header'>, 'title' | 'children' | 'onDragStart' | 'onDragEnd'> {
    /** What the pane is: a glyph and a name, or a `TabStrip` when `tabs` is set. */
    title: ReactNode;

    /**
     * The title is a strip of tabs, which takes the bar's room and keeps the bar whatever tab is in front.
     * `accessory`, the actions and `trailing` stand at the end of the strip while they hold at most three
     * controls (two and an overflow menu), and in a bar of their own under it once they hold more.
     */
    tabs?: boolean;

    /** The pane's own controls. They fold into a "More actions" popover once the title has given way and they still do not fit. */
    actions?: ReactNode;

    /** A separator between the title and the actions of a pane without tabs. */
    separated?: boolean;

    /** Between the title and the actions, such as a mark that lives on the line over the body. */
    accessory?: ReactNode;

    /** After the actions, such as a sign that the pane fills the view. */
    trailing?: ReactNode;

    focused?: boolean;

    onClose?(): void;
    closeLabel?: string;
    closeShortcut?: Shortcut | string;
    moreActionsLabel?: string;

    /** The items of the bar's context menu. Leave it out for a bar without one. */
    menu?: ReactNode;

    /** With `onDragStart`, the bar is a handle that drags the pane; a press on a control in it never starts one. */
    onDragStart?(event: DragEvent<HTMLElement>): void;

    onDragEnd?(event: DragEvent<HTMLElement>): void;

    /**
     * An element to draw the bar in instead of over the pane, such as the slot of a `WorkspaceTopRow`. The bar
     * stays the pane's in the tree, so its events still reach the pane's handlers. A separator leads it there.
     */
    container?: HTMLElement | null;
}

/**
 * The bar over a pane: its title or its tabs, its actions and its close button. Drawn in a `container` it
 * takes that element's height and background, and only its title answers the pointer, so a window can be
 * dragged by the rest.
 */
export function PaneBar({
    title,
    tabs = false,
    actions,
    separated = false,
    accessory,
    trailing,
    focused = false,
    onClose,
    closeLabel,
    closeShortcut,
    moreActionsLabel,
    menu,
    onDragStart,
    onDragEnd,
    container = null,
    className,
    ...props
}: PaneBarProps) {
    const { t } = useTranslation('ui');
    /* Whether the pointer came down on the bar itself. A drag starts on the nearest draggable ancestor, so
       `draggable` on a child does not hold it back: the attribute itself has to go while the pointer is in a
       control, or selecting text in an address field would drag the pane away instead. */
    const [grabbable, setGrabbable] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const bar = useRef<HTMLElement>(null);
    const actionsBar = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLSpanElement>(null);
    const partRef = useRef<HTMLSpanElement>(null);
    const hasActions = hasNode(actions);
    const hasPart = hasActions || hasNode(accessory) || hasNode(trailing);
    const beside = useBesideTabs(partRef, tabs && hasPart);
    // Beside the tabs nothing folds: what does not fit there has a bar of its own.
    const folded = useFolded(tabs ? actionsBar : bar, actionsRef, hasActions && !(tabs && beside));
    const inContainer = container !== null;
    const draggable = onDragStart !== undefined;

    const actionsPart = hasActions && (
        <>
            {!folded && (
                <>
                    {!tabs && separated && <Separator />}
                    {/* The controls keep their minimum width so overflow can trigger folding. */}
                    <span ref={actionsRef} className="flex min-w-min grow items-center">
                        {actions}
                    </span>
                </>
            )}
            {folded && (
                <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
                    <IconButton
                        icon={MoreHorizontal}
                        size="sm"
                        label={moreActionsLabel ?? t('workspace.moreActions')}
                        className="cursor-default"
                        render={<Popover.Trigger />}
                    />
                    {/* A popover keeps the keys of controls such as an address field. */}
                    <Popover.Popup sideOffset={6} align="end" className="flex min-w-72 items-center gap-2 p-2 text-xs">
                        {actions}
                    </Popover.Popup>
                </Popover.Root>
            )}
            {/* Still mounted while folded, so what portals into the actions keeps its place to go. */}
            {folded && !menuOpen && (
                <span hidden className="hidden">
                    {actions}
                </span>
            )}
        </>
    );

    const part = tabs && hasPart && (
        <span
            ref={partRef}
            data-pane-part=""
            className={clsx(
                'flex items-center gap-2 empty:hidden',
                beside ? 'shrink-0' : 'min-w-0 grow',
                // Without actions that grow, nothing else would push the rest to the end.
                !beside && (folded || !hasActions) && 'justify-end'
            )}
        >
            {accessory}
            {actionsPart}
            {trailing}
        </span>
    );

    const header = (
        <header
            {...props}
            ref={bar}
            data-pane-bar=""
            data-placement={inContainer ? 'container' : undefined}
            draggable={draggable && grabbable}
            className={clsx(
                'ade-pane-bar flex items-center gap-2 overflow-hidden text-xs',
                draggable && 'cursor-grab active:cursor-grabbing',
                inContainer
                    ? 'h-full min-w-0 grow text-text'
                    : clsx(
                          'h-10 shrink-0 border-b border-border pr-1.5',
                          !tabs && 'pl-2',
                          focused ? 'bg-surface text-text' : 'bg-surface-idle text-text-muted'
                      ),
                className
            )}
            onPointerDown={(event) => {
                setGrabbable(!(event.target as HTMLElement | null)?.closest(CONTROLS));
                props.onPointerDown?.(event);
            }}
            onPointerUp={(event) => {
                setGrabbable(true);
                props.onPointerUp?.(event);
            }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            {/* The title gives way first, down to its glyph. With tabs, the strip takes its place. */}
            <span
                data-pane-title=""
                className={clsx(
                    'ade-pane-title flex items-center gap-2',
                    tabs ? 'min-w-24 self-stretch' : 'min-w-5',
                    /* In a container the first text stands as far after the separator as the text before it
                       stands before it: 16 pixels, of which the gap brings 8 and a tab 12 of its own. */
                    inContainer ? (tabs ? '-ml-1' : 'pl-2') : !tabs && 'pl-1',
                    // The separator after the title stands as far from it as the one before it does.
                    inContainer && !tabs && separated && hasActions && !folded && 'pr-2',
                    // A weight rather than `shrink`, since controls whose labels truncate shrink as well.
                    !inContainer && (tabs || folded || !hasActions) ? 'grow' : 'shrink-100'
                )}
            >
                {title}
            </span>
            {!tabs && (
                <>
                    {accessory}
                    {actionsPart}
                </>
            )}
            {/* The room the title leaves in a container, which the window drags by. */}
            {inContainer && (tabs || folded || !hasActions) && <span aria-hidden="true" className="grow self-stretch" />}
            {!tabs && trailing}
            {beside && part}
            {/* Sets the close button of the pane apart from what the tab in front brings; gone with a part that draws nothing. */}
            {beside && part && onClose && <Separator className="[[data-pane-part]:empty+&]:hidden" />}
            {onClose && (
                <CloseButton label={closeLabel ?? t('workspace.closePane')} kbd={closeShortcut} size="sm" className="cursor-default" onClick={onClose} />
            )}
        </header>
    );

    const placed =
        menu === undefined ? (
            header
        ) : (
            <ContextMenu.Root>
                <ContextMenu.Trigger render={header} />
                <ContextMenu.Popup>{menu}</ContextMenu.Popup>
            </ContextMenu.Root>
        );

    return (
        <>
            {inContainer
                ? createPortal(
                      <>
                          <Separator />
                          {placed}
                      </>,
                      container
                  )
                : placed}
            {part && !beside && (
                <div
                    ref={actionsBar}
                    data-pane-actions=""
                    className={clsx(
                        'flex h-10 shrink-0 items-center overflow-hidden border-b border-border px-2 text-xs',
                        focused ? 'bg-surface text-text' : 'bg-surface-idle text-text-muted'
                    )}
                >
                    {part}
                </div>
            )}
        </>
    );
}
