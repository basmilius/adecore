import { useId, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { useRender } from '@base-ui-components/react/use-render';
import { FieldContext } from './field-context.ts';
import { SectionLabel } from './SectionLabel.tsx';

const HINT = 'text-xs text-text-muted';
const ERROR = 'text-xs text-status-error';

export type FieldHintProps = useRender.ComponentProps<'p'>;

/* The line under a field that says what goes in it. */
export function FieldHint({ render, className, ref, ...props }: FieldHintProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'p',
        props: { ...props, className: clsx('mt-1', HINT, className) }
    });
}

export type FormErrorProps = useRender.ComponentProps<'p'>;

/* What went wrong in a dialog or a form. An alert, so a screen reader hears it arrive. */
export function FormError({ render, className, ref, ...props }: FormErrorProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'p',
        props: { role: 'alert', ...props, className: clsx(ERROR, className) }
    });
}

export interface FieldProps {
    label?: ReactNode;
    hint?: ReactNode;
    /* Shown under the control and marks it invalid; null or empty shows nothing. */
    error?: ReactNode;
    /*
     * For what a `<label>` cannot point at: a `Segmented`, a `Select`, cards to choose from, a path
     * in a box with a button beside it. The label then names a group around it, which the hint and
     * the error describe.
     */
    group?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
    /* The control. An `Input` or a `TextArea` connects to the label and the lines under it by itself, unless the field is a `group`. */
    children: ReactNode;
}

/* A labelled control, or a labelled group, with an optional hint and error under it, stacked 6px apart. */
export function Field({ label, hint, error, group = false, className, ref, children }: FieldProps) {
    const id = useId();
    const hasLabel = label !== undefined;
    const hasHint = hint !== undefined && hint !== null && hint !== '';
    const hasError = error !== undefined && error !== null && error !== '';
    const describedBy = [hasHint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter((part) => part !== null).join(' ') || undefined;
    return (
        <div
            ref={ref}
            role={group ? 'group' : undefined}
            aria-labelledby={group && hasLabel ? `${id}-label` : undefined}
            aria-describedby={group ? describedBy : undefined}
            className={clsx('flex flex-col gap-1.5', className)}
        >
            {hasLabel &&
                (group ? (
                    <SectionLabel id={`${id}-label`}>{label}</SectionLabel>
                ) : (
                    <SectionLabel render={<label htmlFor={`${id}-control`} />}>{label}</SectionLabel>
                ))}
            {/* A group describes itself, so an input inside it stays unconnected rather than taking an id nothing points at. */}
            <FieldContext value={group ? null : { id: `${id}-control`, describedBy, invalid: hasError }}>{children}</FieldContext>
            {/* The stack already puts 6px above each line, so neither takes the margin a standalone hint has. */}
            {hasHint && (
                <p id={`${id}-hint`} className={HINT}>
                    {hint}
                </p>
            )}
            {hasError && (
                <p id={`${id}-error`} role="alert" className={clsx(ERROR, 'break-words')}>
                    {error}
                </p>
            )}
        </div>
    );
}
