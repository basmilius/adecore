import { useContext, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { CircleOff } from 'lucide-react';
import { Icon } from '@adecore/ui';
import { useChatHost } from '../../host';
import { REFERENCE_GONE_TONE, REFERENCE_TONE, TOKEN_ICON, TOKEN_IN_MESSAGE } from './chips';
import { referenceGlyph } from './reference-icons';
import { ReferenceLookupContext } from './reference-lookup';

interface TokenChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    /* `gone` for a reference that stands for nothing any more, which a copy leaves as text. */
    kind: 'mention' | 'skill' | 'reference' | 'gone';
    /* The path, the skill's name or the reference's id. */
    value?: string;
    /* The sigil the mark stands in for. Hidden, but a selection copies it with the name. */
    sigil?: string;
    icon: ReactNode;
    label: string;
    tone: string;
    onOpen?: () => void;
}

/*
 * One token in the transcript. One that opens is a span with a button's role rather than a button,
 * since a button is a box with a baseline of its own and would not sit on the line the others sit on.
 */
export function TokenChip({ kind, value, sigil, icon, label, tone, onOpen, className, ...rest }: TokenChipProps) {
    const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>): void => {
        if (onOpen !== undefined && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen();
        }
    };

    return (
        <span
            {...rest}
            className={clsx(TOKEN_IN_MESSAGE, tone, onOpen !== undefined && 'cursor-pointer focus-visible:outline-2 focus-visible:outline-accent', className)}
            data-chip={kind}
            data-chip-value={value}
            data-chip-name={kind === 'reference' ? label : undefined}
            role={onOpen === undefined ? undefined : 'button'}
            tabIndex={onOpen === undefined ? undefined : 0}
            onClick={onOpen}
            onKeyDown={onOpen === undefined ? undefined : onKeyDown}
        >
            {icon}
            {sigil !== undefined && <span className="sr-only">{sigil}</span>}
            {label}
        </span>
    );
}

/*
 * A view, node or chat a message points at, under the name it has now. One that went says so, under
 * `lastName` when the message knows what it was called.
 */
export function ReferenceChip({ id, lastName }: { id: string; lastName?: string }) {
    const { t } = useTranslation('agent-chat');
    const { items, open } = useContext(ReferenceLookupContext);
    const { ReferenceIcon } = useChatHost();
    const item = items.find((candidate) => candidate.id === id);

    if (item === undefined) {
        return (
            <TokenChip
                kind="gone"
                icon={<Icon icon={CircleOff} size={14} className={TOKEN_ICON} />}
                label={lastName || t('references.gone')}
                tone={REFERENCE_GONE_TONE}
            />
        );
    }

    return (
        <TokenChip
            kind="reference"
            value={item.id}
            sigil="#"
            icon={referenceGlyph(ReferenceIcon, { id: item.id, kind: item.kind, size: 14, className: TOKEN_ICON })}
            label={item.name || t('references.untitled')}
            tone={clsx(REFERENCE_TONE, open !== null && 'hover:bg-text/12')}
            onOpen={open === null ? undefined : () => open(item.id)}
        />
    );
}
