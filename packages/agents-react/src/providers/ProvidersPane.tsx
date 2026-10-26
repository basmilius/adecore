import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentKind, ProviderInfo } from '@adecore/agent-contracts';
import { accountLoginOf, accountsOfKind, type AccountEntry } from '../agents/accounts';
import { ErrorBoundary, Skeleton } from '@adecore/ui';
import { MasterDetail } from '@adecore/ui/settings';
import { useChatHost } from '../host';
import { useChatScope } from '../scope';
import { AccountDetail } from './AccountDetail';
import { AddAccountForm } from './AddAccountForm';
import { CliDetail } from './CliDetail';
import { InstallPage } from './InstallPage';
import type { ProviderInstallStep } from './install-steps';
import { pickOfCli, pickOfTarget, type Picked } from './pane-target';
import { groupProviders, type ProviderSetupStatus } from './provider-groups';
import { ProviderList } from './ProviderList';
import { useProviderAccounts } from '../state/provider-accounts';
import { useProviders } from '../state/providers';
import { useHostLoginBlocked } from '../host-hooks';

interface ProvidersPaneProps {
    /* The row a search result leads to, by its `searchId`; the pane opens on the CLI it belongs to. `providers.install.<kind>` opens on that CLI's install page, or on its detail once it is installed. */
    target?: string | null;
    /* The detail of a provider the app draws itself, such as a model the host runs on its own; null draws the CLI's own. */
    detailOf?(provider: ProviderInfo): ReactNode | null;
    /* False leaves "Defaults for new chats" out of a CLI's detail, for an app that decides those elsewhere. */
    defaults?: boolean;
    /* A step of the app's own on the install page of a CLI, after its install, such as a server its chat needs; null adds none. */
    installStepOf?(provider: ProviderInfo): ProviderInstallStep | null;
    /* Why a provider is not usable yet when the app knows better than its accounts, such as one turned off in its own detail; null leaves it to the accounts. */
    setupStatusOf?(provider: ProviderInfo): ProviderSetupStatus | null;
    /* Sections of the app's own under a CLI's usual detail, such as its version and an update; null adds none. */
    sectionsOf?(provider: ProviderInfo): ReactNode | null;
    /* A page of the app's own to add a provider from, such as a catalog to install one; the list then ends in a row that opens it. `added` picks the provider it added. */
    addPage?(added: (kind: AgentKind) => void): ReactNode;
}

/* The agent CLIs of the host in scope, each with its accounts, beside the detail of what is picked. */
export function ProvidersPane({ target = null, detailOf, defaults = true, installStepOf, setupStatusOf, sectionsOf, addPage }: ProvidersPaneProps) {
    const { t } = useTranslation('agent-providers');
    const { id: scopeId } = useChatScope();
    const providers = useProviders((s) => s.providers);
    const loaded = useProviders((s) => s.loaded);
    const accounts = useProviderAccounts((s) => s.accounts);
    const host = useChatHost();
    const { openLogin } = host;
    const loginBlocked = useHostLoginBlocked(scopeId);
    const [picked, setPicked] = useState<Picked | null>(() => pickOfTarget(target, providers));

    const groups = groupProviders(providers, accounts, setupStatusOf);
    const installed = [...groups.ready, ...groups.setup].map((row) => row.provider);

    const entriesOf = (kind: AgentKind): AccountEntry[] => accountsOfKind(accounts, kind);

    const loginOf = (kind: AgentKind) => accountLoginOf(accounts, kind);

    // What was picked may be gone since (an account removed elsewhere); the first CLI stands in for it.
    const pickedEntry = picked?.kind === 'account' ? (Object.hasOwn(accounts?.accounts ?? {}, picked.id) ? picked.id : null) : null;

    // A CLI taken off the host since it was picked makes way too, so the detail never stays empty.
    const keeps = (entry: Picked): boolean => {
        switch (entry.kind) {
            case 'account':
                return pickedEntry !== null;
            case 'catalog':
                return addPage !== undefined;
            case 'cli':
                return !loaded || installed.some((provider) => provider.kind === entry.cli);
            default:
                return true;
        }
    };

    const current: Picked | null = picked !== null && keeps(picked) ? picked : installed[0] ? { kind: 'cli', cli: installed[0].kind } : null;
    const currentAccount = current?.kind === 'account' ? accounts?.accounts[current.id] : undefined;

    const currentCli =
        current === null || current.kind === 'catalog' ? null : current.kind === 'account' ? (currentAccount?.kind as AgentKind | undefined) : current.cli;

    const provider = (current?.kind === 'install' ? providers : installed).find((entry) => entry.kind === currentCli) ?? null;

    // A search result lands on a row of a CLI's detail, so a picked account makes way for its CLI.
    const [seenTarget, setSeenTarget] = useState(target);

    if (target !== seenTarget) {
        setSeenTarget(target);
        const opened = pickOfTarget(target, providers);

        if (opened !== null) {
            setPicked(opened);
        } else if (target?.startsWith('providers.') && current?.kind !== 'cli' && provider !== null) {
            setPicked({ kind: 'cli', cli: provider.kind });
        }
    }

    const added = (id: string, name: string, made: boolean): void => {
        setPicked({ kind: 'account', id });

        if (made && provider !== null && loginOf(provider.kind) === 'terminal' && openLogin !== null && loginBlocked === null) {
            void openLogin(scopeId, provider.kind, id, name);
        }
    };

    const list = !loaded ? (
        <div className="flex flex-col gap-3 p-3">
            <Skeleton className="w-32" />
            <Skeleton className="w-40" />
        </div>
    ) : (
        <ProviderList
            groups={groups}
            current={current}
            canAddAccount={(kind) => loginOf(kind) !== null}
            canAddProvider={addPage !== undefined}
            onPick={setPicked}
        />
    );

    const detail = (): ReactNode => {
        if (current?.kind === 'catalog') {
            return addPage?.((kind) => setPicked(pickOfCli(kind, providers))) ?? null;
        }

        if (current === null || provider === null) {
            return null;
        }

        if (current.kind === 'install') {
            const extra = installStepOf?.(provider) ?? null;
            const statuses = entriesOf(provider.kind).map((entry) => entry.status?.state);
            // Without accounts to read, nothing says the CLI is signed out, so being there is all it takes.
            const signedIn = statuses.length === 0 || statuses.includes('ready');

            if (!provider.installed || !signedIn || (extra !== null && !extra.done)) {
                return <InstallPage key={provider.kind} provider={provider} signedIn={signedIn} extra={extra} />;
            }
        }

        const own = current.kind === 'cli' || current.kind === 'install' ? (detailOf?.(provider) ?? null) : null;

        if (own !== null) {
            return own;
        }

        if (current.kind === 'add') {
            return (
                <AddAccountForm
                    key={provider.kind}
                    provider={provider}
                    entries={entriesOf(provider.kind)}
                    login={loginOf(provider.kind)}
                    onCancel={() => setPicked({ kind: 'cli', cli: provider.kind })}
                    onAdded={added}
                />
            );
        }

        if (current.kind === 'account') {
            const entry = entriesOf(provider.kind).find((candidate) => candidate.id === current.id);

            return (
                entry && (
                    <AccountDetail
                        key={entry.id}
                        provider={provider}
                        entry={entry}
                        login={loginOf(provider.kind)}
                        canOpenLogin={openLogin !== null}
                        loginBlocked={loginBlocked}
                        secretsAvailable={accounts?.secretsAvailable === true}
                        onRemoved={() => setPicked({ kind: 'cli', cli: provider.kind })}
                    />
                )
            );
        }

        return (
            <>
                <CliDetail
                    provider={provider}
                    entries={accounts === null ? null : entriesOf(provider.kind)}
                    defaults={defaults}
                    login={loginOf(provider.kind)}
                    onAddAccount={() => setPicked({ kind: 'add', cli: provider.kind })}
                    onPickAccount={(id) => setPicked({ kind: 'account', id })}
                />
                {sectionsOf?.(provider) ?? null}
            </>
        );
    };

    return (
        <MasterDetail
            listWidth={340}
            listLabel={t('list.label')}
            list={list}
            detail={
                <ErrorBoundary label={t('failed')} resetKeys={[scopeId, current?.kind, currentCli]}>
                    <div className="flex min-w-0 flex-col gap-7">{detail()}</div>
                </ErrorBoundary>
            }
        />
    );
}
