import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonSize, type ButtonVariant } from './Button.tsx';
import { copyText } from './clipboard.ts';
import { Icon } from './Icon.tsx';
import { IconButton, type IconButtonSize } from './IconButton.tsx';
import type { TooltipSide } from './Tooltip.tsx';

const COPIED_MS = 1500;

interface CopyButtonBase {
    text: string;

    /* The accessible name and the tooltip of the icon, or the word on the button with `showLabel`. */
    label?: string;

    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

interface CopyIconButtonProps extends CopyButtonBase {
    showLabel?: false;
    size?: IconButtonSize;
    tooltipSide?: TooltipSide;
}

interface CopyLabelButtonProps extends CopyButtonBase {
    showLabel: true;
    size?: ButtonSize;
    variant?: ButtonVariant;
}

export type CopyButtonProps = CopyIconButtonProps | CopyLabelButtonProps;

/* A button that puts text on the clipboard and shows a check and "Copied" for a moment once it got there. */
export function CopyButton(props: CopyButtonProps) {
    const { text, label, disabled, className, ref } = props;
    const { t } = useTranslation('ui');
    const [copiedAt, setCopiedAt] = useState<number | null>(null);

    useEffect(() => {
        if (copiedAt === null) {
            return;
        }

        const timer = window.setTimeout(() => setCopiedAt(null), COPIED_MS);

        return () => window.clearTimeout(timer);
    }, [copiedAt]);

    const copied = copiedAt !== null;
    const name = label ?? t('action.copy');

    const copy = async (): Promise<void> => {
        // A refusal goes unconfirmed and unreported: a person can do nothing about it (`clipboard.ts`).
        if (await copyText(text)) {
            setCopiedAt(Date.now());
        }
    };

    const button = props.showLabel ? (
        <Button ref={ref} variant={props.variant} size={props.size} disabled={disabled} className={className} onClick={() => void copy()}>
            <Icon icon={copied ? Check : Copy} size={props.size === 'xs' ? 12 : 14} />
            {copied ? t('action.copied') : name}
        </Button>
    ) : (
        <IconButton
            ref={ref}
            icon={copied ? Check : Copy}
            label={name}
            tooltip={copied ? t('action.copied') : name}
            tooltipSide={props.tooltipSide}
            size={props.size}
            disabled={disabled}
            className={className}
            onClick={() => void copy()}
        />
    );

    return (
        <>
            {button}
            {/* The check is only drawn, and a focused button's new name is not always read out. A new node
                per copy, as a region whose text stays the same says nothing for the second one. */}
            <span role="status" className="sr-only">
                <span key={copiedAt}>{copied ? t('action.copied') : ''}</span>
            </span>
        </>
    );
}
