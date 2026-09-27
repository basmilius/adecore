import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, ChevronRight } from 'lucide-react';
import { ContextMenu as BaseContextMenu } from '@base-ui-components/react/context-menu';
import { Menu as BaseMenu } from '@base-ui-components/react/menu';
import { Separator as BaseSeparator } from '@base-ui-components/react/separator';
import { useRender } from '@base-ui-components/react/use-render';
import { withClass } from '../class-name.ts';
import { Icon } from '../Icon.tsx';

/* Where a popup opens from decides where it goes when a call site says nothing. */
type MenuKind = 'menu' | 'context' | 'submenu';

const MenuKindContext = createContext<MenuKind>('menu');

type PositionerProps = ComponentProps<typeof BaseMenu.Positioner>;

type Placement = Pick<
    PositionerProps,
    'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding' | 'collisionBoundary' | 'collisionAvoidance' | 'anchor' | 'sticky' | 'positionMethod'
>;

/*
 * A menu hangs under its trigger, lined up with its start, unless there is no room. A context menu
 * opens at the pointer, which its positioner already knows. A submenu sits beside its row, pulled
 * up by the popup's own padding so its first row lines up with the row that opened it.
 */
const PLACEMENT: Record<MenuKind, Placement> = {
    menu: { side: 'bottom', align: 'start', sideOffset: 6 },
    context: {},
    submenu: { sideOffset: 4, alignOffset: -4 }
};

/* The label above a group of rows. It takes the line height of the row it sits in. */
export const MENU_LABEL = 'px-2.5 pt-1.5 pb-0.5 text-xs/[inherit] text-text-faint';

/* A trailing hint in a row: what the item does to something else, never a shortcut. A shortcut stays a `Kbd`, which `.menu-item` already pushes to the right. */
const MENU_HINT = 'ml-auto pl-3 text-xs/[inherit] text-text-faint';

/* The hairline between two groups of rows. It runs the whole width of the popup, which is what the
   negative margin buys back from its 4px of padding, and it is softer than a border a surface ends with. */
const MENU_SEPARATOR = '-mx-1 my-1 h-px bg-border-soft';

export function MenuRoot(props: ComponentProps<typeof BaseMenu.Root>) {
    return (
        <MenuKindContext value="menu">
            <BaseMenu.Root {...props} />
        </MenuKindContext>
    );
}

export function ContextMenuRoot(props: ComponentProps<typeof BaseContextMenu.Root>) {
    return (
        <MenuKindContext value="context">
            <BaseContextMenu.Root {...props} />
        </MenuKindContext>
    );
}

export function MenuSubmenuRoot(props: ComponentProps<typeof BaseMenu.SubmenuRoot>) {
    return (
        <MenuKindContext value="submenu">
            <BaseMenu.SubmenuRoot {...props} />
        </MenuKindContext>
    );
}

export const MenuTrigger = BaseMenu.Trigger;

export const ContextMenuTrigger = BaseContextMenu.Trigger;

export type MenuPopupProps = ComponentProps<typeof BaseMenu.Popup> & Placement;

/*
 * The shell every menu is drawn in: the portal, the layer it sits on and the gap to its trigger are
 * decided once. The popup scrolls inside the room the window leaves it; `className` adds a minimum
 * width or a layout of its own, such as a grid of swatches.
 */
export function MenuPopup({
    side,
    align,
    sideOffset,
    alignOffset,
    collisionPadding,
    collisionBoundary,
    collisionAvoidance,
    anchor,
    sticky,
    positionMethod,
    className,
    ...props
}: MenuPopupProps) {
    const defaults = PLACEMENT[useContext(MenuKindContext)];
    return (
        <BaseMenu.Portal>
            <BaseMenu.Positioner
                className="z-(--z-popup)"
                side={side ?? defaults.side}
                align={align ?? defaults.align}
                sideOffset={sideOffset ?? defaults.sideOffset}
                alignOffset={alignOffset ?? defaults.alignOffset}
                collisionPadding={collisionPadding}
                collisionBoundary={collisionBoundary}
                collisionAvoidance={collisionAvoidance}
                anchor={anchor}
                sticky={sticky}
                positionMethod={positionMethod}
            >
                <BaseMenu.Popup className={withClass('menu-popup', className)} {...props} />
            </BaseMenu.Positioner>
        </BaseMenu.Portal>
    );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof BaseMenu.Item>) {
    return <BaseMenu.Item className={withClass('menu-item', className)} {...props} />;
}

export interface MenuCheckProps {
    /* One of several is a bare tick; on or off is a tick in an outlined box, which says the row can be off. */
    kind: 'radio' | 'checkbox';
    /* Only for a row that is not a radio or checkbox item, and so has no indicator of its own. */
    checked?: boolean;
    className?: string;
}

/*
 * The slot before the label of a row that can be checked, in a menu or a list that reads as one. It
 * is one line of the row tall, so a row with a second line keeps the tick beside its first. Radio and
 * checkbox items draw it themselves; a plain row that shows a state hands it `checked`.
 */
export function MenuCheck({ kind, checked, className }: MenuCheckProps) {
    const tick = <Icon icon={Check} size={kind === 'radio' ? 14 : 12} />;
    const indicator =
        checked !== undefined ? (
            checked && tick
        ) : kind === 'radio' ? (
            <BaseMenu.RadioItemIndicator className="flex">{tick}</BaseMenu.RadioItemIndicator>
        ) : (
            <BaseMenu.CheckboxItemIndicator className="flex">{tick}</BaseMenu.CheckboxItemIndicator>
        );
    return (
        <span className={clsx('grid h-lh w-4 shrink-0 place-items-center', className)}>
            {kind === 'checkbox' ? <span className="grid h-4 w-4 place-items-center rounded border border-border-strong">{indicator}</span> : indicator}
        </span>
    );
}

type CheckboxItemProps = ComponentProps<typeof BaseMenu.CheckboxItem> & { children?: ReactNode };

/* A row that is on or off. The box before its label is part of it. */
export function MenuCheckboxItem({ className, children, ...props }: CheckboxItemProps) {
    return (
        <BaseMenu.CheckboxItem className={withClass('menu-item', className)} {...props}>
            <MenuCheck kind="checkbox" />
            {children}
        </BaseMenu.CheckboxItem>
    );
}

export const MenuRadioGroup = BaseMenu.RadioGroup;

type RadioItemProps = ComponentProps<typeof BaseMenu.RadioItem> & { children?: ReactNode };

/* One of several. The tick before its label is part of it. */
export function MenuRadioItem({ className, children, ...props }: RadioItemProps) {
    return (
        <BaseMenu.RadioItem className={withClass('menu-item', className)} {...props}>
            <MenuCheck kind="radio" />
            {children}
        </BaseMenu.RadioItem>
    );
}

type SubmenuTriggerProps = ComponentProps<typeof BaseMenu.SubmenuTrigger> & {
    children?: ReactNode;
    /* The chevron at the end of the row that says it opens more. Off for a row that carries a hint there instead. */
    chevron?: boolean;
};

export function MenuSubmenuTrigger({ className, children, chevron = true, ...props }: SubmenuTriggerProps) {
    return (
        <BaseMenu.SubmenuTrigger className={withClass('menu-item', className)} {...props}>
            {children}
            {chevron && <Icon icon={ChevronRight} size={14} className="ml-auto text-text-faint" />}
        </BaseMenu.SubmenuTrigger>
    );
}

/* Also right between two groups of rows in a popover that reads as a menu. */
export function MenuSeparator({ className, ...props }: ComponentProps<typeof BaseSeparator>) {
    return <BaseSeparator className={withClass(MENU_SEPARATOR, className)} {...props} />;
}

export const MenuGroup = BaseMenu.Group;

export function MenuGroupLabel({ className, ...props }: ComponentProps<typeof BaseMenu.GroupLabel>) {
    return <BaseMenu.GroupLabel className={withClass(MENU_LABEL, className)} {...props} />;
}

export type MenuLabelProps = useRender.ComponentProps<'div'>;

/* A label above rows that are not a `Menu.Group` of their own, such as a row of swatches. */
export function MenuLabel({ render, className, ref, ...props }: MenuLabelProps) {
    return useRender({ render, ref, defaultTagName: 'div', props: { ...props, className: clsx(MENU_LABEL, className) } });
}

export type MenuHintProps = useRender.ComponentProps<'span'>;

export function MenuHint({ render, className, ref, ...props }: MenuHintProps) {
    return useRender({ render, ref, defaultTagName: 'span', props: { ...props, className: clsx(MENU_HINT, className) } });
}
