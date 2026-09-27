import type { ComponentProps } from 'react';
import clsx from 'clsx';
import { useFieldControl } from './field-context.ts';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
    /* `sm` is the height of a small button: a row of tools, or a name typed in place of the label it renames. */
    size?: 'md' | 'sm';
    /* A branch, a path or anything else read back letter by letter. */
    mono?: boolean;
}

/* The one text input: one border and one focus ring at the one height or the compact one. */
export function Input({ size = 'md', mono = false, className, id, ...props }: InputProps) {
    const field = useFieldControl();
    return (
        <input
            id={id ?? field?.id}
            aria-describedby={field?.describedBy}
            aria-invalid={field?.invalid || undefined}
            {...props}
            className={clsx('field', size === 'sm' && 'field-sm', mono && 'font-mono text-code', className)}
        />
    );
}

export type TextAreaProps = ComponentProps<'textarea'>;

/* A field of a few lines: a commit message, the body of a pull request, a note. It grows from 64px and never resizes by hand. */
export function TextArea({ className, id, ...props }: TextAreaProps) {
    const field = useFieldControl();
    return (
        <textarea
            id={id ?? field?.id}
            aria-describedby={field?.describedBy}
            aria-invalid={field?.invalid || undefined}
            {...props}
            className={clsx('field h-auto min-h-16 resize-none px-2 py-1.5 text-xs', className)}
        />
    );
}
