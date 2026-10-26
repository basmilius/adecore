import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ChevronDown, Hourglass } from 'lucide-react';
import type { ChatInfo } from '@adecore/agent-contracts';
import { AccountDot } from '../../agents/AccountDot';
import { continueTargets, hasUnreadAccount, limitsOfAccount, sessionWindow } from '../../agents/account-limits';
import { canContinueOn, type AccountEntry } from '../../agents/accounts';
import { useAccountChoice, type AccountChoice } from '../account-choice';
import { limitView } from '../logic/limit';
import { useFormatLocale } from '@adecore/ui/format';
import { Switch, Button, ButtonGroup, Icon, Menu, Pill, Tooltip, useNow } from '@adecore/ui';
import { useUsageLimits } from '../../usage/limits';
import { useChats } from '../../state/chats';
import { useChatHost } from '../../host';
import { useChatScope, type ChatScope } from '../../scope';
import { useChatActions } from '../actions';
import { useUsageStore } from '../../state/usage';
import { SessionLine } from './SessionLine';
import { useHostResumeAtReset } from '../../host-hooks';
import { errorMessage } from '../../transport';

// A time a limit names reads as a clock today and with its day after that, so the words follow the minute.
const MINUTE_MS = 60_000;

// Reading an account's plan starts its CLI, so an account nobody used yet is read at most this often per host.
const UNREAD_REFRESH_MS = 5 * MINUTE_MS;
const refreshedAt = new Map<string, number>();

/*
 * The host reads the plan of an account other than a CLI's default one only while it is in use, so
 * an account that could take the chat over may have no numbers yet. The dock asks for them.
 */
function readUnreadAccounts(scope: ChatScope): void {
    const last = refreshedAt.get(scope.id);

    if (last !== undefined && Date.now() - last < UNREAD_REFRESH_MS) {
        return;
    }

    refreshedAt.set(scope.id, Date.now());

    void scope.transport
        .request('usage.refreshLimits', {})
        .then((snapshot) => useUsageStore.getState().setLimits(scope.id, snapshot))
        .catch(() => undefined);
}

/*
 * The chat's own "Resume at reset". It only counts while the host allows it, so with the host's
 * switch off it stands off and says where that switch is.
 */
function ResumeAtResetToggle({ chatId, info }: { chatId: string; info: ChatInfo }) {
    const { t } = useTranslation('agent-chat');
    const { id } = useChatScope();
    const actions = useChatActions();
    const machineAllows = useHostResumeAtReset(id);

    const set = (on: boolean): void => {
        void actions.configure(chatId, { resumeAtReset: on }).catch(() => undefined);
    };

    return (
        <Tooltip label={machineAllows ? t('limit.toggle') : t('limit.machineOff')}>
            {/* A disabled switch does not take the pointer, so the tooltip hangs on a wrapper. */}
            <span className="inline-flex shrink-0">
                <Switch checked={machineAllows && info.resumeAtReset !== false} onCheckedChange={set} label={t('limit.toggle')} disabled={!machineAllows} />
            </span>
        </Tooltip>
    );
}

/*
 * Another account of the chat's CLI with room, only ever offered since it spends someone's other plan, and
 * never remembered. One that reads the chat's conversation takes it over; any other goes on in a fork.
 */
function ContinueOn({ chatId, info, choice }: { chatId: string; info: ChatInfo; choice: AccountChoice }) {
    const host = useChatHost();
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const actions = useChatActions();
    const limits = useUsageLimits();
    const [busy, setBusy] = useState(false);
    const targets = continueTargets(choice.accounts, limits, info.provider, info.account);
    const unread = limits !== null && hasUnreadAccount(choice.accounts, limits, info.provider, info.account);

    useEffect(() => {
        if (unread) {
            readUnreadAccounts(scope);
        }
    }, [scope, unread]);

    const target = targets[0];

    if (target === undefined) {
        return null;
    }

    const go = (entry: AccountEntry): void => {
        setBusy(true);

        actions
            .continueOn(chatId, entry.id)
            .catch((e: unknown) =>
                host.notify({
                    kind: 'error',
                    title: t('limit.continueFailed', { account: choice.nameOf(entry) }),
                    description: errorMessage(e)
                })
            )
            .finally(() => setBusy(false));
    };

    const name = choice.nameOf(target);
    const split = targets.length > 1;

    const suggestion = (
        <Tooltip label={t('limit.continueOnTip', { account: name })}>
            <Button
                variant="secondary"
                size="sm"
                className={clsx('shrink-0 gap-1.5 whitespace-nowrap', split && 'rounded-r-none')}
                disabled={busy}
                aria-label={t('limit.continueOnAria', { account: name })}
                onClick={() => go(target)}
            >
                {t('limit.continueOn')}
                <AccountDot color={target.account.color} className="size-1.75" />
                {name}
            </Button>
        </Tooltip>
    );

    if (!split) {
        return suggestion;
    }

    return (
        <ButtonGroup className="shrink-0">
            {suggestion}
            <Menu.Root>
                <Tooltip label={t('limit.chooseAccount')} name>
                    <Menu.Trigger render={<Button variant="secondary" size="sm" className="-ml-px rounded-l-none border-l-0 px-1.5" disabled={busy} />}>
                        <Icon icon={ChevronDown} size={14} />
                    </Menu.Trigger>
                </Tooltip>
                <Menu.Popup align="end" className="min-w-64">
                    <Menu.Group>
                        <Menu.GroupLabel>{t('limit.continueOn')}</Menu.GroupLabel>
                        <ContinueOnRows targets={targets} info={info} choice={choice} onPick={go} />
                    </Menu.Group>
                </Menu.Popup>
            </Menu.Root>
        </ButtonGroup>
    );
}

/* Mounted only while the menu is open, so the clock of the session lines only ticks while someone reads them. */
function ContinueOnRows({
    targets,
    info,
    choice,
    onPick
}: {
    targets: AccountEntry[];
    info: ChatInfo;
    choice: AccountChoice;
    onPick(entry: AccountEntry): void;
}) {
    const { t } = useTranslation('agent-chat');
    const limits = useUsageLimits();
    const now = useNow(MINUTE_MS);

    return targets.map((entry) => {
        const name = choice.nameOf(entry);
        const session = sessionWindow(limitsOfAccount(limits, entry.id));
        const fork = !canContinueOn(choice.accounts, info.provider, info.account, entry.id);

        return (
            <Menu.Item
                key={entry.id}
                className="items-start"
                aria-label={t(fork ? 'limit.continueInForkAria' : 'limit.continueOnAria', { account: name })}
                onClick={() => onPick(entry)}
            >
                <span className="flex min-w-0 grow flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                        <AccountDot color={entry.account.color} />
                        <span className="truncate">{name}</span>
                        {fork && <Menu.Hint>{t('limit.inFork')}</Menu.Hint>}
                    </span>
                    {session !== null && <SessionLine window={session} now={now} />}
                </span>
            </Menu.Item>
        );
    });
}

/* At the top of the composer while the last turn stopped on a limit: what stopped it, when it goes on, and the switch. */
export function LimitDock({ chatId, info }: { chatId: string; info: ChatInfo }) {
    const { t } = useTranslation('agent-chat');
    useFormatLocale();
    const now = useNow(MINUTE_MS, info.limit !== undefined);
    const choice = useAccountChoice(info.provider, info.account);
    const view = limitView(info, now);

    if (view === null) {
        return null;
    }

    // With a choice of accounts the line names the one that ran into the limit.
    const account = choice === null ? null : choice.current === null ? choice.currentId : choice.nameOf(choice.current);
    const detail = account === null ? view.detail : view.detail === null ? account : `${account} · ${view.detail}`;

    return (
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Icon icon={Hourglass} size={16} className="shrink-0 text-text-faint" />
            <span className="flex min-w-0 grow flex-col">
                <span className="truncate text-sm text-text">{view.title}</span>
                {detail !== null && <span className="truncate text-xs tabular-nums text-text-faint">{detail}</span>}
            </span>
            {choice !== null && info.limit?.kind === 'usage' && <ContinueOn chatId={chatId} info={info} choice={choice} />}
            <span className="shrink-0 text-xs text-text-muted">{t('limit.toggle')}</span>
            <ResumeAtResetToggle chatId={chatId} info={info} />
        </div>
    );
}

/* The same state in a chat node's header, read from the status every client gets, so a node nobody opened says it too. */
export function LimitPill({ chatId }: { chatId: string }) {
    const { keyOf } = useChatScope();
    const info = useChats((s) => s.statusByKey[keyOf(chatId)]?.info);
    useFormatLocale();
    const now = useNow(MINUTE_MS, info?.limit !== undefined);
    const view = info === undefined ? null : limitView(info, now);

    if (info === undefined || view === null) {
        return null;
    }

    return (
        <>
            <Tooltip label={view.detail === null ? view.title : `${view.title}. ${view.detail}`}>
                <Pill className="tabular-nums" icon={<Icon icon={Hourglass} size={12} />}>
                    {view.pill}
                </Pill>
            </Tooltip>
            <ResumeAtResetToggle chatId={chatId} info={info} />
        </>
    );
}
