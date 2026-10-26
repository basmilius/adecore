import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { withClass } from '../class-name.ts';
import { fieldControlProps, useFieldControl } from '../field-context.ts';
import { Icon } from '../Icon.tsx';
import { Kbd } from '../Kbd.tsx';
import { MENU_LABEL } from '../menu/parts.tsx';
import { splitPlacement, type PlacementKey } from '../placement.ts';
import { renderPositioner } from '../popup-layer.ts';
import type { Shortcut } from '../shortcut.ts';

/* It takes no room while it has nothing to say. */
const LIST_NOTE = 'text-center text-xs text-text-faint not-empty:px-3 not-empty:py-4';

/* The field keeps free text: Base UI's autocomplete, whose suggestions only offer text, rather than its combobox, which holds a value. */
export const ComboboxRoot = Autocomplete.Root;

export type ComboboxInputProps = Omit<ComponentProps<typeof Autocomplete.Input>, 'size' | 'className'> & {
    className?: string;
    /* The heights of `Input`. */
    size?: 'md' | 'sm';
    mono?: boolean;
    /* Drawn in front of the text. `className` then goes to the box around the icon and the input; `ref` stays on the input. */
    icon?: LucideIcon;
};

export function ComboboxInput({ size = 'md', mono = false, icon, className, id, ...props }: ComboboxInputProps) {
    const field = useFieldControl();
    const small = size === 'sm';
    const control = { ...fieldControlProps(field, id), ...props };

    if (icon === undefined) {
        return <Autocomplete.Input {...control} className={clsx('field', small && 'field-sm', mono && 'font-mono text-code', className)} />;
    }

    // The group is what the popup lines up with, so a list under a field with an icon is as wide as the whole box.
    return (
        <Autocomplete.InputGroup className={clsx('field relative flex p-0', small && 'field-sm', className)}>
            <Icon
                icon={icon}
                size={small ? 12 : 14}
                className={clsx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-faint', small ? 'left-2' : 'left-2.5')}
            />
            <Autocomplete.Input
                {...control}
                className={clsx(
                    'min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-faint',
                    small ? 'pr-2 pl-7' : 'pr-2.5 pl-8',
                    mono && 'font-mono text-code'
                )}
            />
        </Autocomplete.InputGroup>
    );
}

type Placement = Pick<ComponentProps<typeof Autocomplete.Positioner>, PlacementKey>;

export type ComboboxPopupProps = ComponentProps<typeof Autocomplete.Popup> & Placement;

export function ComboboxPopup({ side = 'bottom', align = 'start', sideOffset = 6, className, ...props }: ComboboxPopupProps) {
    const [placement, popupProps] = splitPlacement(props);
    return (
        <Autocomplete.Portal>
            <Autocomplete.Positioner className="popup-positioner" render={renderPositioner} {...placement} side={side} align={align} sideOffset={sideOffset}>
                <Autocomplete.Popup className={withClass('menu-popup min-w-(--anchor-width)', className)} {...popupProps} />
            </Autocomplete.Positioner>
        </Autocomplete.Portal>
    );
}

export function ComboboxList(props: ComponentProps<typeof Autocomplete.List>) {
    const { t } = useTranslation('ui');
    return <Autocomplete.List aria-label={t('combobox.suggestions')} {...props} />;
}

export type ComboboxItemProps = ComponentProps<typeof Autocomplete.Item> & {
    icon?: ReactNode;
    /* The first to give way when the row is narrow. */
    hint?: ReactNode;
    description?: ReactNode;
    /* Before the shortcut. */
    trailing?: ReactNode;
    shortcut?: Shortcut;
    /* Keeps only what makes it an option, for a row that lays out itself. */
    unstyled?: boolean;
};

/* Base UI clicks the row for Enter, so a modifier held with Enter is read in the field's `onKeyDown` instead. */
export function ComboboxItem({ icon, hint, description, trailing, shortcut, unstyled = false, className, children, ...props }: ComboboxItemProps) {
    if (unstyled) {
        return (
            <Autocomplete.Item className={className} {...props}>
                {children}
            </Autocomplete.Item>
        );
    }
    const label = <span className="min-w-0 truncate">{children}</span>;
    return (
        <Autocomplete.Item className={withClass(clsx('menu-item', description !== undefined && 'items-start'), className)} {...props}>
            {icon !== undefined && <span className="flex h-lh shrink-0 items-center text-text-faint">{icon}</span>}
            {description === undefined ? (
                label
            ) : (
                <span className="flex min-w-0 flex-col">
                    {label}
                    <span className="truncate text-xs text-text-faint">{description}</span>
                </span>
            )}
            {hint !== undefined && <span className="min-w-0 shrink-1000 truncate text-xs/[inherit] text-text-faint">{hint}</span>}
            {(trailing !== undefined || shortcut !== undefined) && (
                <span className="ml-auto flex h-lh shrink-0 items-center gap-2 pl-3">
                    {trailing}
                    {shortcut !== undefined && <Kbd shortcut={shortcut} />}
                </span>
            )}
        </Autocomplete.Item>
    );
}

export const ComboboxGroup = Autocomplete.Group;

export function ComboboxGroupLabel({ className, ...props }: ComponentProps<typeof Autocomplete.GroupLabel>) {
    return <Autocomplete.GroupLabel className={withClass(MENU_LABEL, className)} {...props} />;
}

export const ComboboxCollection = Autocomplete.Collection;

/* Its children show only while the list has no rows. Needs `items` on the root. */
export function ComboboxEmpty({ className, ...props }: ComponentProps<typeof Autocomplete.Empty>) {
    return <Autocomplete.Empty className={withClass(LIST_NOTE, className)} {...props} />;
}

/* Read out as it changes. It stays mounted; only its children come and go. */
export function ComboboxStatus({ className, ...props }: ComponentProps<typeof Autocomplete.Status>) {
    return <Autocomplete.Status className={withClass(LIST_NOTE, className)} {...props} />;
}
