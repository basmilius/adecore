import { useState, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button.tsx';
import { DialogDescription, DialogFooter, DialogPopup, DialogRoot, DialogTitle } from './dialog/parts.tsx';
import { Field, FormError } from './Field.tsx';
import { Icon } from './Icon.tsx';
import { Input, TextArea } from './Input.tsx';
import { useAsyncAction } from './useAsyncAction.ts';

export interface PromptDialogProps {
    open: boolean;
    title: string;
    titleIcon?: LucideIcon;
    description?: ReactNode;

    /* Without it the dialog is a confirm and nothing else. */
    field?: {
        /* Without one only a screen reader hears the name, from `ariaLabel`. */
        label?: string;

        ariaLabel?: string;
        initial?: string;
        placeholder?: string;
        mono?: boolean;
        maxLength?: number;
    };

    /* A second, taller field under it. */
    area?: { label: string; initial?: string; placeholder?: string };

    confirmLabel: string;
    confirmBusyLabel?: string;
    confirmIcon?: LucideIcon;
    danger?: boolean;

    /* For a step the caller runs elsewhere; a step this dialog awaits says so itself. */
    busy?: boolean;

    allowEmpty?: boolean;

    /* A reason this question cannot be answered at all, beside the one an empty field is. */
    confirmDisabled?: boolean;

    secondary?: { label: string; onClick(): void };
    nested?: boolean;

    /* Between the description and the buttons. */
    children?: ReactNode;

    /* A rejection stays on screen as the reason and leaves the dialog open. */
    onConfirm(value: string, body: string): void | Promise<unknown>;

    /* For a rejection that carries no sentence of its own. */
    fallbackMessage?: string;

    /* Only ever told `false`: the dialog never closes itself. */
    onOpenChange(open: boolean): void;

    /* On the popup. */
    className?: string;

    ref?: Ref<HTMLDivElement>;
}

/* It never closes itself: an action that asks a second question would be shut out by a close of its own. */
export function PromptDialog({
    open,
    title,
    titleIcon,
    description,
    field,
    area,
    confirmLabel,
    confirmBusyLabel,
    confirmIcon,
    danger = false,
    busy = false,
    allowEmpty = false,
    confirmDisabled = false,
    secondary,
    nested = false,
    children,
    onConfirm,
    fallbackMessage,
    onOpenChange,
    className,
    ref
}: PromptDialogProps) {
    const { t } = useTranslation('ui');
    /* The dialog stays mounted between questions; a new question resets the fields in the render that shows it. */
    const token = open ? `${field?.initial ?? ''}\u0000${area?.initial ?? ''}` : '';
    const [draft, setDraft] = useState({ token, value: field?.initial ?? '', body: area?.initial ?? '' });
    const step = useAsyncAction(fallbackMessage);

    if (draft.token !== token) {
        setDraft({ token, value: field?.initial ?? '', body: area?.initial ?? '' });
        step.clear();
    }

    const { value, body } = draft;
    const working = busy || step.busy;

    const setValue = (next: string): void => setDraft({ ...draft, value: next });

    const setBody = (next: string): void => setDraft({ ...draft, body: next });

    const submit = (): void => {
        if (!working && !confirmDisabled && (field === undefined || allowEmpty || value.trim() !== '')) {
            void step.run(async () => await onConfirm(value.trim(), body.trim()));
        }
    };

    const close = (): void => onOpenChange(false);

    return (
        <DialogRoot open={open} onOpenChange={(next) => !next && close()}>
            <DialogPopup ref={ref} size="sm" nested={nested} className={className}>
                <DialogTitle className="flex items-center gap-2 break-words">
                    {titleIcon && <Icon icon={titleIcon} size={16} />}
                    {title}
                </DialogTitle>
                {description !== undefined && <DialogDescription className="mt-1 break-words">{description}</DialogDescription>}
                {field !== undefined && (
                    <Field label={field.label} className="mt-4">
                        <Input
                            autoFocus
                            mono={field.mono === true}
                            aria-label={field.ariaLabel}
                            spellCheck={false}
                            placeholder={field.placeholder}
                            maxLength={field.maxLength}
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            onKeyDown={(event) => {
                                // Whatever listens on the window has keys of its own, and a name may hold any of them.
                                event.stopPropagation();

                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    submit();
                                }
                            }}
                        />
                    </Field>
                )}
                {area !== undefined && (
                    <Field label={area.label} className="mt-3">
                        <TextArea rows={5} spellCheck={false} placeholder={area.placeholder} value={body} onChange={(event) => setBody(event.target.value)} />
                    </Field>
                )}
                {children}
                {step.failure !== null && <FormError className="mt-2 break-words">{step.failure}</FormError>}
                <DialogFooter>
                    <Button onClick={close}>{t('action.cancel')}</Button>
                    {secondary !== undefined && (
                        <Button disabled={working} onClick={secondary.onClick}>
                            {secondary.label}
                        </Button>
                    )}
                    <Button
                        variant={danger ? 'danger' : 'primary'}
                        disabled={working || confirmDisabled || (field !== undefined && !allowEmpty && value.trim() === '')}
                        onClick={submit}
                    >
                        {confirmIcon && <Icon icon={confirmIcon} size={12} />}
                        {working && confirmBusyLabel !== undefined ? confirmBusyLabel : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogPopup>
        </DialogRoot>
    );
}
