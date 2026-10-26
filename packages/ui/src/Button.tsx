import type { AnchorHTMLAttributes, ComponentProps, Ref } from 'react';
import clsx from 'clsx';
import { buttonClass, type ButtonShape, type ButtonSize, type ButtonVariant } from './button-class.ts';

export type { ButtonShape, ButtonSize, ButtonVariant } from './button-class.ts';

export interface ButtonProps extends ComponentProps<'button'> {
    variant?: ButtonVariant;
    size?: ButtonSize;

    /* `pill` is 36 pixels tall and fully rounded, and ignores `size`. */
    shape?: ButtonShape;

    /* Makes it a link that looks like a button, a real anchor, so it opens the way links open. */
    href?: string;
}

/* Every button with a word in it. A button that is only an icon is an `IconButton`, which is a square, not a label. */
export function Button({ variant = 'ghost', size = 'md', shape = 'default', className, href, type = 'button', ref, ...rest }: ButtonProps) {
    const classes = clsx(buttonClass(variant, size, shape), className);

    if (href) {
        return (
            <a
                ref={ref as Ref<HTMLAnchorElement>}
                className={classes}
                href={href}
                target="_blank"
                rel="noreferrer"
                {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
            />
        );
    }

    return <button ref={ref} type={type} className={classes} {...rest} />;
}
