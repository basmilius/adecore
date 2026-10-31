import i18next from 'i18next';
import { useState, type ReactElement } from 'react';
import { AccountLimitsList } from './LimitsList';
import { useLimitGroups, useUsageLimits } from './limits';
import { useNow, PreviewCard } from '@adecore/ui';

const MINUTE_MS = 60_000;

/* Asking the CLIs starts a process each, so the question waits until the card is actually opened. */
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
export function UsageLimitsCard({ children }: { children: ReactElement<Record<string, unknown>> }) {
    const [opened, setOpened] = useState(false);
    const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());

    return (
        <PreviewCard.Root onOpenChange={(open) => open && setOpened(true)}>
            <PreviewCard.Trigger render={children} delay={500} />
            <PreviewCard.Popup side="top" align="end" className="w-85 p-2">
                {opened && <CardBody folded={folded} onFoldedChange={setFolded} />}
            </PreviewCard.Popup>
        </PreviewCard.Root>
    );
}
