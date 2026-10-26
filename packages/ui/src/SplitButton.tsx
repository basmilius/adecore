import { useState, type ComponentProps, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { splitFrameClass, splitHalfClass, type ButtonSize, type ButtonVariant } from './button-class.ts';
import { Icon } from './Icon.tsx';
import { MenuPopup, MenuRoot, MenuTrigger, type MenuPopupProps } from './menu/parts.tsx';
import { mergeRefs } from './merge-refs.ts';
import { Tooltip } from './Tooltip.tsx';

export interface SplitButtonProps extends Omit<ComponentProps<'button'>, 'ref'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /* The hint on the action half. */
    tooltip?: ReactNode;
    /* The rows of the menu the chevron opens. */
    menu: ReactNode;
    /* The accessible name of the chevron, and its hint unless `menuTooltip` says something else. */
    menuLabel: string;
    menuTooltip?: ReactNode;
    menuDisabled?: boolean;
    menuAlign?: MenuPopupProps['align'];
    menuClassName?: string;
    /* On the box around both halves; every other prop goes to the action half. */
    className?: string;
    ref?: ComponentProps<'span'>['ref'];
}

/* Each half is a button of its own, so each takes the focus, can be disabled and carries its own hint; the menu hangs under the whole control. */
export function SplitButton({
    variant = 'secondary',
    size = 'md',
    tooltip,
    menu,
    menuLabel,
    menuTooltip,
    menuDisabled = false,
    menuAlign = 'end',
    menuClassName,
    className,
    ref,
    type = 'button',
    ...props
}: SplitButtonProps) {
    const [box, setBox] = useState<HTMLSpanElement | null>(null);
    const action = <button type={type} className={splitHalfClass(variant, size, 'action')} {...props} />;

    return (
        <span ref={mergeRefs<HTMLSpanElement>(ref, setBox)} className={clsx(splitFrameClass(variant, size), className)}>
            {tooltip === undefined ? action : <Tooltip label={tooltip}>{action}</Tooltip>}
            <MenuRoot>
                <Tooltip label={menuTooltip ?? menuLabel}>
                    <MenuTrigger
                        render={<button type="button" className={splitHalfClass(variant, size, 'menu')} />}
                        aria-label={menuLabel}
                        disabled={menuDisabled}
                    >
                        <Icon icon={ChevronDown} size={14} />
                    </MenuTrigger>
                </Tooltip>
                <MenuPopup anchor={box} align={menuAlign} className={menuClassName}>
                    {menu}
                </MenuPopup>
            </MenuRoot>
        </span>
    );
}
