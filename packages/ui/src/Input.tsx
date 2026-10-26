import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { fieldControlProps, useFieldControl } from './field-context.ts';
import { Icon } from './Icon.tsx';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
    /* `sm` is the height of a small button. */
    size?: 'md' | 'sm';

    mono?: boolean;

    /* `className` then goes to the box around the icon and the input; `ref` stays on the input. */
    icon?: LucideIcon;

    /* Inside the field, after the text. `className` then goes to the box, as with `icon`. */
    end?: ReactNode;
}

export function Input({ size = 'md', mono = false, icon, end, className, id, ...props }: InputProps) {
    const field = useFieldControl();
    const small = size === 'sm';
    const control = { ...fieldControlProps(field, id), ...props };

    if (icon === undefined && end === undefined) {
        return <input {...control} className={clsx('field', small && 'field-sm', mono && 'font-mono text-code', className)} />;
    }

    // The input fills the whole box and the icon lets clicks through, so a click on the icon still lands in the input.
    return (
        <span className={clsx('field relative flex p-0', small && 'field-sm', className)}>
            {icon !== undefined && (
                <Icon
                    icon={icon}
                    size={small ? 12 : 14}
                    className={clsx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-faint', small ? 'left-2' : 'left-2.5')}
                />
            )}
            <input
                {...control}
                className={clsx(
                    'min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-faint',
                    icon === undefined ? (small ? 'pl-2' : 'pl-2.5') : small ? 'pl-7' : 'pl-8',
                    end === undefined ? (small ? 'pr-2' : 'pr-2.5') : 'pr-1',
                    mono && 'font-mono text-code'
                )}
            />
            {end !== undefined && <span className={clsx('flex shrink-0 items-center gap-1', small ? 'pr-0.5' : 'pr-1')}>{end}</span>}
        </span>
    );
}

export interface TextAreaProps extends ComponentProps<'textarea'> {
    /* `sm` is the type and the padding of a small input. */
    size?: 'md' | 'sm';

    resize?: 'none' | 'vertical';
    mono?: boolean;

    /* `bare` drops the border, the ground and the focus outline, for a field inside a card that draws all three around it. */
    variant?: 'field' | 'bare';
}

/* At least 64px tall; `rows` makes it taller. */
export function TextArea({ size = 'md', resize = 'none', mono = false, variant = 'field', className, id, ...props }: TextAreaProps) {
    const field = useFieldControl();

    return (
        <textarea
            {...fieldControlProps(field, id)}
            {...props}
            className={clsx(
                'field h-auto min-h-16 py-1.5',
                size === 'sm' && 'field-sm',
                variant === 'bare' && 'field-bare',
                resize === 'vertical' ? 'resize-y' : 'resize-none',
                mono && 'font-mono text-code',
                className
            )}
        />
    );
}
