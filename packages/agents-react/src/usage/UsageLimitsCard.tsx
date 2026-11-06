import { useNow, PreviewCard } from '@adecore/ui';
import i18next from 'i18next';
import { useState, type ReactElement } from 'react';
import { useLimitGroups, useUsageLimits } from './limits';
import { AccountLimitsList } from './LimitsList';

const MINUTE_MS = 60_000;

/* Asking the CLIs starts a process each, so the question waits until the card opens. */
function CardBody({ folded, onFoldedChange }: { folded: ReadonlySet<string>; onFoldedChange: (folded: ReadonlySet<string>) => void }) {
    const limits = useUsageLimits();
    const groups = useLimitGroups(limits);
    const now = useNow(MINUTE_MS);

    if (limits === null) {
        return <p className="px-1.5 py-1 text-xs text-text-faint">{i18next.t('agent-usage:limits.loading')}</p>;
    }

    if (groups.length === 0) {
        return <p className="px-1.5 py-1 text-xs text-text-faint">{i18next.t('agent-usage:limits.none')}</p>;
    }

    return <AccountLimitsList groups={groups} now={now} folded={folded} onFoldedChange={onFoldedChange} />;
}

/*
 * What is left of each plan, without opening the usage dialog. A hover card rather than a tooltip:
 * the bars take a moment to read, and it stays open while the pointer travels to it.
 */
export function UsageLimitsCard({
    side = 'top',
    open = false,
    children
}: {
    /* Where the card opens: above a button in a footer, or `left` beside one in a column at the window's right edge. */
    side?: 'top' | 'left';
    /* Holds the card open beside the hover, such as while the app's own key is down. */
    open?: boolean;
    children: ReactElement<Record<string, unknown>>;
}) {
    const [hovered, setHovered] = useState(false);
    const [opened, setOpened] = useState(false);
    const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
    const shown = hovered || open;

    if (shown && !opened) {
        setOpened(true);
    }

    return (
        <PreviewCard.Root open={shown} onOpenChange={setHovered}>
            <PreviewCard.Trigger render={children} delay={500} />
            <PreviewCard.Popup side={side} align="end" className="w-85 p-2">
                {opened && <CardBody folded={folded} onFoldedChange={setFolded} />}
            </PreviewCard.Popup>
        </PreviewCard.Root>
    );
}
