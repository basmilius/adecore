import { useState, type ReactNode } from 'react';
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
    /* The mark beside the title, for a dialog that names the thing it is about. */
    titleIcon?: LucideIcon;
    description?: ReactNode;
    /* A one line field the answer is typed in; without it the dialog is a confirm and nothing else. */
    field?: {
        /* Drawn above the field. Without one only a screen reader hears the name, from `ariaLabel`. */
        label?: string;
        ariaLabel?: string;
        initial?: string;
        placeholder?: string;
        /* A branch, a path or anything else read back letter by letter. */
        mono?: boolean;
        maxLength?: number;
    };
    /* A second, taller field under it, for the body of a pull request. */
    area?: { label: string; initial?: string; placeholder?: string };
    confirmLabel: string;
    /* What the button says while the step runs, for one slow enough that a quiet button is not enough. */
    confirmBusyLabel?: string;
    confirmIcon?: LucideIcon;
    danger?: boolean;
    /* The caller runs the step somewhere else and says when it is busy; a step this dialog awaits says so itself. */
    busy?: boolean;
    /* Lets the field be confirmed empty, for a list that may be cleared or a name with a default. */
    allowEmpty?: boolean;
    /* A reason this question cannot be answered at all, beside the one an empty field is. */
    confirmDisabled?: boolean;
    /* A second way out next to the confirm, such as merging before removing. */
    secondary?: { label: string; onClick(): void };
    /* Over another dialog, so what is under it is dimmed a second time. */
    nested?: boolean;
    /* Whatever this question needs beyond a field, between the description and the buttons. */
    children?: ReactNode;
    /* Told what was typed. A rejection stays on screen as the reason and leaves the dialog open. */
    onConfirm(value: string, body: string): void | Promise<unknown>;
    /* What the failure line reads when the rejection carries no sentence of its own. */
    fallbackMessage?: string;
    /* Only ever told `false`: Cancel, Escape or a click outside. The dialog never closes itself. */
    onOpenChange(open: boolean): void;
}

/*
 * The one dialog a question is asked in: a name to type, or a warning to agree with. Every confirm
 * and every rename shares it, so none of them grows a layout of its own. It never closes itself,
 * because what a confirm leads to is the caller's business: an action that asks a second question
 * would be shut out by a close of its own.
 */
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
    onOpenChange
}: PromptDialogProps) {
    const { t } = useTranslation('ui');
    /* The dialog stays mounted between questions, so every opening starts from what it was handed.
       The token is what it was handed, so a new question resets the fields in the same render that
       shows it and not in a second one after. */
    const token = open ? `${field?.initial ?? ''}\u0000${area?.initial ?? ''}` : '';
    const [draft, setDraft] = useState({ token, value: field?.initial ?? '', body: area?.initial ?? '' });
    const step = useAsyncAction(fallbackMessage);
    if (draft.token !== token) {
        setDraft({ token, value: field?.initial ?? '', body: area?.initial ?? '' });
        step.clear();
    }
    const value = draft.value;
    const body = draft.body;
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
            <DialogPopup size="sm" nested={nested}>
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
