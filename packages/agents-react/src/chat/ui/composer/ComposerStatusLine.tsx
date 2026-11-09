import { Icon, Popover, Tooltip } from '@adecore/ui';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ComposerStatusItem } from '../../../host/host';

const ITEM = 'flex h-6 min-w-0 items-center gap-1.5 rounded-md text-xs text-text-muted';

function ItemFace({ item }: { item: ComposerStatusItem }) {
    return (
        <>
            <Icon icon={item.icon} size={14} className="shrink-0 text-text-faint" />
            <span className="truncate">{item.label}</span>
        </>
    );
}

function StatusItem({ item }: { item: ComposerStatusItem }) {
    if (item.details === undefined || item.details.length === 0) {
        const face = (
            <span className={ITEM}>
                <ItemFace item={item} />
            </span>
        );

        return item.tooltip === undefined ? face : <Tooltip label={item.tooltip}>{face}</Tooltip>;
    }

    return (
        <Popover.Root>
            <Tooltip label={item.tooltip ?? item.label}>
                <Popover.Trigger
                    className={clsx(
                        ITEM,
                        '-mx-1.5 px-1.5 hover:bg-surface-hover hover:text-text data-[popup-open]:bg-surface-hover data-[popup-open]:text-text'
                    )}
                >
                    <ItemFace item={item} />
                </Popover.Trigger>
            </Tooltip>
            <Popover.Popup side="top" className="max-w-120 min-w-56 p-1">
                {item.details.map((detail, i) => (
                    <div key={i} className={clsx('flex items-start gap-2.5 px-2.5 py-1.5 text-sm', detail.muted ? 'text-text-muted' : 'text-text')}>
                        <span className="grid h-lh shrink-0 place-items-center">
                            <Icon icon={detail.icon} size={14} className="text-text-faint" />
                        </span>
                        <span className="flex min-w-0 grow flex-col">
                            <span className={clsx('break-words', detail.mono && 'font-mono')}>{detail.label}</span>
                            {detail.detail !== undefined && <span className="font-mono text-xs break-all text-text-faint">{detail.detail}</span>}
                        </span>
                        {detail.hint !== undefined && <span className="shrink-0 pl-3 text-xs/[inherit] text-text-faint">{detail.hint}</span>}
                    </div>
                ))}
            </Popover.Popup>
        </Popover.Root>
    );
}

/* The line under the card with the app's own items, such as the branch a chat works on. Without items there is no line. */
export function ComposerStatusLine({ items }: { items: readonly ComposerStatusItem[] }) {
    const { t } = useTranslation('agent-chat');

    if (items.length === 0) {
        return null;
    }

    const start = items.filter((item) => item.side !== 'end');
    const end = items.filter((item) => item.side === 'end');

    return (
        // Lined up with the text in the box: its padding, and the card's border. It reaches into the strip under
        // the card, so it stands as far from the bottom as a popup of its items stands above it.
        <div
            role="group"
            aria-label={t('composer.status.label')}
            className="pointer-events-auto relative isolate -mb-1 flex min-w-0 items-center gap-3 pt-1.5 pr-5 pl-[calc(--spacing(5)+1px)] @max-md/composer-area:pl-[calc(--spacing(3.5)+1px)]"
        >
            {/* The thread scrolls on under the card, so it fades out under the card's lower edge and is gone by the line, across the strip the card sits in. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-8 bottom-0 -inset-x-3 -z-10 bg-[linear-gradient(to_bottom,transparent,var(--surface)_--spacing(4))]"
            />
            {start.map((item) => (
                <StatusItem key={item.id} item={item} />
            ))}
            {end.length > 0 && (
                <span className="ml-auto flex min-w-0 items-center gap-3">
                    {end.map((item) => (
                        <StatusItem key={item.id} item={item} />
                    ))}
                </span>
            )}
        </div>
    );
}
