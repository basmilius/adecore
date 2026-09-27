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

export interface TextAreaProps extends ComponentProps<'textarea'> {
    /* `sm` is the type and the padding of a small input: a commit message or a note in a narrow panel. */
    size?: 'md' | 'sm';
    /* `vertical` gives it a handle to drag it taller, for a draft of a few sentences. */
    resize?: 'none' | 'vertical';
}

/* A field of a few lines: a commit message, the body of a pull request, a note. At least 64px tall; `rows` makes it taller. */
export function TextArea({ size = 'md', resize = 'none', className, id, ...props }: TextAreaProps) {
    const field = useFieldControl();
    return (
        <textarea
            id={id ?? field?.id}
            aria-describedby={field?.describedBy}
            aria-invalid={field?.invalid || undefined}
            {...props}
            className={clsx('field h-auto min-h-16 py-1.5', size === 'sm' && 'field-sm', resize === 'vertical' ? 'resize-y' : 'resize-none', className)}
        />
    );
}
