import { useContext } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { CircleOff } from 'lucide-react';
import { Icon } from '@adecore/ui';
import { CHIP_IN_MESSAGE, REFERENCE_GONE_TONE, REFERENCE_TONE } from './chips';
import { REFERENCE_ICONS } from './reference-icons';
import { ReferenceLookupContext } from './reference-lookup';

/* A view, node or chat a message points at, under the name it has now; one that went says so. */
export function ReferenceChip({ id }: { id: string }) {
    const { t } = useTranslation('agent-chat');
    const { items, open } = useContext(ReferenceLookupContext);
    const item = items.find((candidate) => candidate.id === id);
    if (item === undefined) {
        return (
            <span className={clsx(CHIP_IN_MESSAGE, REFERENCE_GONE_TONE)}>
                <Icon icon={CircleOff} size={12} className="shrink-0" />
                <span className="truncate">{t('references.gone')}</span>
            </span>
        );
    }
    const name = item.name || t('references.untitled');
    const face = (
        <>
            <Icon icon={REFERENCE_ICONS[item.kind]} size={12} className="shrink-0" />
            <span className="truncate">{name}</span>
        </>
    );
    if (open === null) {
        return <span className={clsx(CHIP_IN_MESSAGE, REFERENCE_TONE)}>{face}</span>;
    }
    return (
        <button type="button" className={clsx(CHIP_IN_MESSAGE, REFERENCE_TONE, 'cursor-pointer hover:bg-text/12')} onClick={() => open(item.id)}>
            {face}
        </button>
    );
}
