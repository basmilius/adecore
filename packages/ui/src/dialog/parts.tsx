import { createContext, useContext, useState, type ComponentProps } from 'react';
import clsx from 'clsx';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { useRender } from '@base-ui/react/use-render';
import { withClass } from '../class-name.ts';
import { useDialogLayer } from '../dialog-layer.ts';

const DialogOpenContext = createContext(false);

/* Every question is as wide as the others, whatever it asks. */
const SIZE = {
    sm: 'w-[420px] p-5'
} as const;

export function DialogRoot({ open, defaultOpen, onOpenChange, ...props }: ComponentProps<typeof BaseDialog.Root>) {
    // Followed rather than taken over, so a dialog that keeps its own state still does.
    const [seen, setSeen] = useState(defaultOpen ?? false);

    return (
        <DialogOpenContext value={open ?? seen}>
            <BaseDialog.Root
                open={open}
                defaultOpen={defaultOpen}
                onOpenChange={(next, details) => {
                    onOpenChange?.(next, details);

                    if (!details.isCanceled) {
                        setSeen(next);
                    }
                }}
                {...props}
            />
        </DialogOpenContext>
    );
}

export const DialogTrigger = BaseDialog.Trigger;

export const DialogClose = BaseDialog.Close;

export type DialogPopupProps = ComponentProps<typeof BaseDialog.Popup> & {
    /* `sm` is the dialog of a question or a few fields. Without a size the popup is as wide as its `className` says. */
    size?: keyof typeof SIZE;

    /* Always over another dialog. A dialog that opens while another one is up stacks by itself. */
    nested?: boolean;

    backdrop?: boolean;
    backdropClassName?: string;
    keepMounted?: boolean;
};

/* The portal, the backdrop and the popup of a dialog in one part; `useDialogLayer` says whether it stacks. */
export function DialogPopup({ size, nested = false, backdrop = true, backdropClassName, keepMounted, className, ...props }: DialogPopupProps) {
    const stacked = useDialogLayer(useContext(DialogOpenContext)) || nested;

    return (
        <BaseDialog.Portal keepMounted={keepMounted}>
            {backdrop && (
                <BaseDialog.Backdrop className={clsx('dialog-backdrop', stacked && 'dialog-backdrop-nested', backdropClassName)} forceRender={stacked} />
            )}
            <BaseDialog.Popup
                className={withClass(clsx('dialog-popup', size !== undefined && SIZE[size], stacked && 'dialog-popup-nested'), className)}
                {...props}
            />
        </BaseDialog.Portal>
    );
}

export type DialogTitleProps = ComponentProps<typeof BaseDialog.Title> & {
    /* `lg` for a dialog with a header of its own rather than a question. */
    size?: 'base' | 'lg';
};

export function DialogTitle({ size = 'base', className, ...props }: DialogTitleProps) {
    return <BaseDialog.Title className={withClass(clsx(size === 'lg' ? 'text-lg' : 'text-base', 'font-semibold text-text'), className)} {...props} />;
}

const DESCRIPTION = { sm: 'text-sm text-text-muted', xs: 'text-xs text-text-muted' } as const;

export type DialogDescriptionProps = ComponentProps<typeof BaseDialog.Description> & {
    size?: keyof typeof DESCRIPTION;
};

/* What a screen reader reads as the dialog's description. It carries no margin. */
export function DialogDescription({ size = 'sm', className, ...props }: DialogDescriptionProps) {
    return <BaseDialog.Description className={withClass(DESCRIPTION[size], className)} {...props} />;
}

export type DialogTextProps = useRender.ComponentProps<'p'> & {
    size?: keyof typeof DESCRIPTION;
};

/* Styled as the description without being the dialog's description. */
export function DialogText({ size = 'sm', render, className, ref, ...props }: DialogTextProps) {
    return useRender({ render, ref, defaultTagName: 'p', props: { ...props, className: clsx(DESCRIPTION[size], className) } });
}

export type DialogFooterProps = useRender.ComponentProps<'div'>;

/* The main action goes last, and so on the right. */
export function DialogFooter({ render, className, ref, ...props }: DialogFooterProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: { ...props, className: clsx('mt-4 flex flex-wrap items-center justify-end gap-2', className) }
    });
}
