import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useFieldControl } from './field-context.ts';
import { Icon } from './Icon.tsx';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
    /* `sm` is the height of a small button: a row of tools, or a name typed in place of the label it renames. */
    size?: 'md' | 'sm';
    /* A branch, a path or anything else read back letter by letter. */
    mono?: boolean;
    /* Drawn in front of the text, such as a magnifier on a search field. `className` then goes to the box around the icon and the input; `ref` stays on the input. */
    icon?: LucideIcon;
}

/* The one text input: one border and one focus ring at the one height or the compact one. */
export function Input({ size = 'md', mono = false, icon, className, id, ...props }: InputProps) {
    const field = useFieldControl();
    const small = size === 'sm';
    const control = {
        id: id ?? field?.id,
        'aria-describedby': field?.describedBy,
        'aria-invalid': field?.invalid || undefined,
        ...props
    };

    if (icon === undefined) {
        return <input {...control} className={clsx('field', small && 'field-sm', mono && 'font-mono text-code', className)} />;
    }

    // The input fills the whole box and the icon lets clicks through, so a click on the icon still lands in the input.
    return (
        <span className={clsx('field relative flex p-0', small && 'field-sm', className)}>
            <Icon
                icon={icon}
                size={small ? 12 : 14}
                className={clsx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-faint', small ? 'left-2' : 'left-2.5')}
            />
            <input
                {...control}
                className={clsx(
                    'min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-faint',
                    small ? 'pr-2 pl-7' : 'pr-2.5 pl-8',
                    mono && 'font-mono text-code'
                )}
            />
        </span>
    );
}

export interface TextAreaProps extends ComponentProps<'textarea'> {
    /* `sm` is the type and the padding of a small input: a commit message or a note in a narrow panel. */
    size?: 'md' | 'sm';
    /* `vertical` gives it a handle to drag it taller, for a draft of a few sentences. */
    resize?: 'none' | 'vertical';
    /* A command or anything else read back letter by letter. */
    mono?: boolean;
}

/* A field of a few lines: a commit message, the body of a pull request, a note. At least 64px tall; `rows` makes it taller. */
export function TextArea({ size = 'md', resize = 'none', mono = false, className, id, ...props }: TextAreaProps) {
    const field = useFieldControl();
    return (
        <textarea
            id={id ?? field?.id}
            aria-describedby={field?.describedBy}
            aria-invalid={field?.invalid || undefined}
            {...props}
            className={clsx(
                'field h-auto min-h-16 py-1.5',
                size === 'sm' && 'field-sm',
                resize === 'vertical' ? 'resize-y' : 'resize-none',
                mono && 'font-mono text-code',
                className
            )}
        />
    );
}
