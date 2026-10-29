import { useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, GripVertical } from 'lucide-react';
import { Icon, Pill, Tooltip } from '@adecore/ui';
import { AccountDot } from '../agents/AccountDot';
import { ACCOUNT_TONE_CLASSES, accountName, accountStatusLine, movedIds, topAccountEntry, type AccountEntry, type AccountLogin } from '../agents/accounts';

const DRAG_TYPE = 'application/x-adecore-account';

interface AccountOrderListProps {
    entries: readonly AccountEntry[];
    providerName: string;
    login: AccountLogin;
    /* Null while the machine keeps no order, which draws the rows without handles. */
    onReorder: ((ids: string[]) => void) | null;
    onPickAccount(id: string): void;
}

/* The accounts of one CLI in the person's order, dragged by their handle or moved with Alt+Up and Alt+Down; the top one that is on is tagged as the default. */
export function AccountOrderList({ entries, providerName, login, onReorder, onPickAccount }: AccountOrderListProps) {
    const { t } = useTranslation('agent-providers');
    const [dragged, setDragged] = useState<string | null>(null);
    const [over, setOver] = useState<number | null>(null);
    const ids = entries.map((entry) => entry.id);
    const top = topAccountEntry(entries);
    const reorder = entries.length >= 2 ? onReorder : null;

    const move = (id: string, to: number): void => {
        const next = movedIds(ids, id, to);

        if (reorder !== null && next.some((candidate, index) => candidate !== ids[index])) {
            reorder(next);
        }
    };

    const onKeyDown = (event: KeyboardEvent, id: string, index: number): void => {
        if (reorder === null || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
            return;
        }

        event.preventDefault();
        move(id, event.key === 'ArrowUp' ? index - 1 : index + 1);
    };

    const placeOf = (event: DragEvent, index: number): number => {
        const box = event.currentTarget.getBoundingClientRect();

        return event.clientY > box.top + box.height / 2 ? index + 1 : index;
    };

    const onDrop = (event: DragEvent, index: number): void => {
        event.preventDefault();
        const id = event.dataTransfer.getData(DRAG_TYPE);
        const from = ids.indexOf(id);
        const place = placeOf(event, index);
        setDragged(null);
        setOver(null);

        if (from !== -1) {
            move(id, place > from ? place - 1 : place);
        }
    };

    return (
        <>
            {entries.map((entry, index) => {
                const status = accountStatusLine(entry.status, login === 'terminal');
                const name = accountName(entry, providerName);

                return (
                    <div
                        key={entry.id}
                        className={`relative flex w-full min-w-0 items-center first:rounded-t-xl last:rounded-b-xl hover:bg-surface-hover ${dragged === entry.id ? 'opacity-50' : ''}`}
                        onDragOver={(event) => {
                            if (dragged !== null) {
                                event.preventDefault();
                                setOver(placeOf(event, index));
                            }
                        }}
                        onDrop={(event) => onDrop(event, index)}
                    >
                        {over === index && <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" />}
                        {over === index + 1 && index === entries.length - 1 && (
                            <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />
                        )}
                        {reorder !== null && (
                            <Tooltip label={t('cli.reorderHandle', { account: name })}>
                                <span
                                    aria-hidden
                                    draggable
                                    className="flex shrink-0 cursor-grab items-center self-stretch pl-3 text-text-faint"
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(DRAG_TYPE, entry.id);
                                        event.dataTransfer.effectAllowed = 'move';
                                        setDragged(entry.id);
                                    }}
                                    onDragEnd={() => {
                                        setDragged(null);
                                        setOver(null);
                                    }}
                                >
                                    <Icon icon={GripVertical} size={14} />
                                </span>
                            </Tooltip>
                        )}
                        <button
                            type="button"
                            aria-keyshortcuts={reorder === null ? undefined : 'Alt+ArrowUp Alt+ArrowDown'}
                            className={`flex min-w-0 grow items-center gap-3 py-3 pr-4.5 text-left ${reorder === null ? 'pl-4.5' : 'pl-2.5'}`}
                            onClick={() => onPickAccount(entry.id)}
                            onKeyDown={(event) => onKeyDown(event, entry.id, index)}
                        >
                            <AccountDot color={entry.account.color} />
                            <span className="min-w-0 truncate text-sm text-text">{name}</span>
                            {entries.length >= 2 && entry.id === top?.id && <Pill size="sm">{t('cli.defaultTag')}</Pill>}
                            <span className={`ml-auto shrink-0 text-xs ${ACCOUNT_TONE_CLASSES[status.tone]}`}>{status.text}</span>
                            <Icon icon={ChevronRight} size={14} className="shrink-0 text-text-faint" />
                        </button>
                    </div>
                );
            })}
        </>
    );
}
