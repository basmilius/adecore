import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { AgentKind } from '@adecore/agent-contracts';
import { AccountDot } from '../agents/AccountDot';
import { accountName } from '../agents/accounts';
import { Icon, IconButton, SectionLabel } from '@adecore/ui';
import type { Picked } from './pane-target';
import { CliMark } from './parts';
import { accountNote, type ProviderGroups, type ProviderRow, type ProviderSetupStatus } from './provider-groups';

const NOTE_TONES: Record<ProviderSetupStatus['tone'], string> = {
    muted: 'text-text-muted',
    warning: 'text-status-needs-you'
};

function Note({ note }: { note: ProviderSetupStatus | null }) {
    return note === null ? null : <span className={clsx('shrink-0 truncate text-xs', NOTE_TONES[note.tone])}>{note.text}</span>;
}

/*
 * A row of the list with a control of its own beside the part that picks it, so the two never nest. Every row
 * keeps the control's room, so the words on the right line up whether a row has one or not.
 */
function ListRow({
    selected,
    onSelect,
    children,
    trailing,
    className
}: {
    selected: boolean;
    onSelect(): void;
    children: ReactNode;
    trailing?: ReactNode;
    className?: string;
}) {
    return (
        <div className={clsx('group flex min-w-0 shrink-0 items-center gap-1 rounded-lg pr-1', selected ? 'bg-text/5' : 'hover:bg-surface-hover')}>
            <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                className={clsx('flex min-w-0 grow items-center gap-3 self-stretch rounded-lg pl-3 text-left focus-visible:-outline-offset-2', className)}
                onClick={onSelect}
            >
                {children}
            </button>
            <span className="flex w-7 shrink-0 justify-center">{trailing}</span>
        </div>
    );
}

interface ProviderListProps {
    groups: ProviderGroups;
    current: Picked | null;
    canAddAccount(kind: AgentKind): boolean;
    /* Whether the list ends in a row that opens the host's page to add a provider. */
    canAddProvider?: boolean;
    onPick(picked: Picked): void;
}

/* The providers by whether they are ready, need setup or are not installed; a group without providers is left out. */
export function ProviderList({ groups, current, canAddAccount, canAddProvider = false, onPick }: ProviderListProps) {
    const { t } = useTranslation('agent-providers');

    const picksCli = (kind: AgentKind): boolean => (current?.kind === 'cli' || current?.kind === 'install') && current.cli === kind;

    const picksAccount = (id: string): boolean => current?.kind === 'account' && current.id === id;

    const row = ({ provider, entries, note }: ProviderRow) => {
        // One account has no row of its own, so picking it lights up its provider.
        const several = entries.length > 1;
        const selected = picksCli(provider.kind) || (!several && entries[0] !== undefined && picksAccount(entries[0].id));

        return (
            <div key={provider.kind} className="flex min-w-0 shrink-0 flex-col gap-0.5">
                <ListRow
                    selected={selected}
                    onSelect={() => onPick({ kind: 'cli', cli: provider.kind })}
                    className="py-2"
                    trailing={
                        canAddAccount(provider.kind) && (
                            <IconButton
                                icon={Plus}
                                size="sm"
                                label={t('list.addAccount', { provider: provider.name })}
                                className={clsx('group-hover:opacity-100 focus-visible:opacity-100', selected ? 'opacity-100' : 'opacity-0')}
                                onClick={() => onPick({ kind: 'add', cli: provider.kind })}
                            />
                        )
                    }
                >
                    <CliMark kind={provider.kind} />
                    <span className="min-w-0 grow truncate text-sm font-medium text-text">{provider.name}</span>
                    {!several && <Note note={note} />}
                </ListRow>
                {several &&
                    entries.map((entry) => (
                        <ListRow key={entry.id} selected={picksAccount(entry.id)} onSelect={() => onPick({ kind: 'account', id: entry.id })} className="py-1.5">
                            <span className="grid w-3.5 shrink-0 place-items-center">
                                <AccountDot color={entry.account.color} className="size-2.25" />
                            </span>
                            <span className="min-w-0 grow truncate text-sm text-text">{accountName(entry, provider.name)}</span>
                            {entry.isDefault && (
                                <span className="shrink-0 rounded-md bg-surface-active px-1.5 text-xs text-text-muted">{t('list.default')}</span>
                            )}
                            <Note note={accountNote(entry.status)} />
                        </ListRow>
                    ))}
            </div>
        );
    };

    const section = (label: string, rows: ReactNode) => (
        <section key={label} aria-label={label} className="flex min-w-0 shrink-0 flex-col gap-0.5 pb-2">
            <SectionLabel className="px-3 pt-1 pb-1">{label}</SectionLabel>
            {rows}
        </section>
    );

    return (
        <>
            {groups.ready.length > 0 && section(t('list.ready'), groups.ready.map(row))}
            {groups.setup.length > 0 && section(t('list.needsSetup'), groups.setup.map(row))}
            {groups.ready.length === 0 && groups.setup.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">{t('list.none')}</p>}
            {groups.missing.length > 0 &&
                section(
                    t('list.notInstalled'),
                    <>
                        {groups.missing.map((provider) => (
                            <ListRow
                                key={provider.kind}
                                selected={picksCli(provider.kind)}
                                onSelect={() => onPick({ kind: 'install', cli: provider.kind })}
                                className="py-2"
                            >
                                <CliMark kind={provider.kind} className="opacity-60" />
                                <span className="min-w-0 grow truncate text-sm font-medium text-text-muted">{provider.name}</span>
                            </ListRow>
                        ))}
                        {groups.missing.every((provider) => provider.install === undefined) && (
                            <p className="mt-1 px-3 text-xs text-text-faint">{t('list.notInstalledNote')}</p>
                        )}
                    </>
                )}
            {canAddProvider && (
                <ListRow selected={current?.kind === 'catalog'} onSelect={() => onPick({ kind: 'catalog' })} className="py-2">
                    <span className="grid w-3.5 shrink-0 place-items-center text-text-muted">
                        <Icon icon={Plus} size={14} />
                    </span>
                    <span className="min-w-0 grow truncate text-sm text-text-muted">{t('list.addProvider')}</span>
                </ListRow>
            )}
        </>
    );
}
