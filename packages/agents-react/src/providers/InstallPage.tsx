import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Trans, useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink, SquareTerminal } from 'lucide-react';
import type { ProviderInfo, ProviderPlatform, ProviderSignIn } from '@adecore/agent-contracts';
import { Button, copyText, Icon, Pill, Segmented } from '@adecore/ui';
import { useChatHost } from '../host';
import { useHostMachinePlatform } from '../host-hooks';
import { useChatScope } from '../scope';
import { installPlatforms, installStepStates, pagePlatform, type InstallStepState, type ProviderInstallStep } from './install-steps';
import { CliMark } from './parts';

function CommandBlock({ command }: { command: string }) {
    const { t } = useTranslation('agent-providers');
    const [copied, setCopied] = useState<string | null>(null);

    return (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-sunken py-1 pr-1 pl-3">
            <code className="min-w-0 grow font-mono text-code break-all text-text select-text">{command}</code>
            <Button
                size="xs"
                onClick={() => {
                    copyText(command);
                    setCopied(command);
                }}
            >
                <Icon icon={copied === command ? Check : Copy} size={12} />
                {copied === command ? t('install.copied') : t('install.copy')}
            </Button>
        </div>
    );
}

function Step({ index, state, title, children }: { index: number; state: InstallStepState; title: string; children?: ReactNode }) {
    return (
        <li
            aria-current={state === 'current' ? 'step' : undefined}
            data-state={state}
            className={clsx('flex min-w-0 gap-3 rounded-xl border p-4', state === 'current' ? 'border-accent' : 'border-border')}
        >
            <span
                className={clsx(
                    'grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium',
                    state === 'done' && 'bg-positive text-positive-text',
                    state === 'current' && 'border border-accent text-accent',
                    state === 'later' && 'bg-text/7 text-text-faint'
                )}
            >
                {state === 'done' ? <Icon icon={Check} size={14} /> : index + 1}
            </span>
            <div className="flex min-w-0 grow flex-col gap-3">
                <h4 className={clsx('text-sm leading-6 font-medium', state === 'later' ? 'text-text-muted' : 'text-text')}>{title}</h4>
                {children}
            </div>
        </li>
    );
}

function SignInWay({ way, canRun, onRun }: { way: ProviderSignIn; canRun: boolean; onRun(command: string): void }) {
    const { t } = useTranslation('agent-providers');
    const { providerKeyNote } = useChatHost();

    switch (way.kind) {
        case 'command':
            return (
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-xs text-text-muted">{t('install.signIn.command')}</p>
                    <CommandBlock command={way.command} />
                    {canRun && (
                        <Button variant="secondary" size="sm" className="self-start" onClick={() => onRun(way.command)}>
                            <Icon icon={SquareTerminal} size={14} />
                            {t('install.run')}
                        </Button>
                    )}
                </div>
            );
        case 'env': {
            const note = providerKeyNote?.(way.variable) ?? null;

            return (
                <p className="text-xs text-text-muted">
                    <Trans
                        t={t}
                        i18nKey="install.signIn.env"
                        values={{ variable: way.variable }}
                        components={{ code: <code className="font-mono text-code text-text" /> }}
                    />
                    {note !== null && ` ${note}`}
                </p>
            );
        }
        case 'chat':
            return <p className="text-xs text-text-muted">{t('install.signIn.chat')}</p>;
    }
}

interface InstallPageProps {
    provider: ProviderInfo;
    signedIn: boolean;
    /* The host's own step, after the install of the CLI. */
    extra: ProviderInstallStep | null;
}

/* How to get a CLI that is not on the machine yet, step by step, until it is there and signed in. */
export function InstallPage({ provider, signedIn, extra }: InstallPageProps) {
    const { t } = useTranslation('agent-providers');
    const { id: scopeId } = useChatScope();
    const host = useChatHost();
    const machine = useHostMachinePlatform(scopeId) ?? pagePlatform();
    const { offered, initial } = installPlatforms(provider, machine);
    // Only a person's pick is kept, so a machine whose system arrives late still opens on its own.
    const [chosen, setPlatform] = useState<ProviderPlatform | null>(null);
    const platform = chosen ?? initial;
    const install = provider.install;
    const run = host.runProviderCommand;

    const onRun = (command: string): void => run?.(scopeId, provider.kind, command);

    const command = platform === null ? undefined : install?.commands[platform];

    const steps: { title: string; done: boolean; body: ReactNode }[] = [];

    steps.push({
        title: t('install.install.title'),
        done: provider.installed,
        body: provider.installed ? (
            <p className="text-xs text-text-muted">
                {provider.version ? t('install.install.done', { version: provider.version }) : t('install.install.doneNoVersion')}
            </p>
        ) : (
            <>
                {offered.length > 1 && platform !== null && (
                    <Segmented<ProviderPlatform>
                        value={platform}
                        label={t('install.platform')}
                        options={offered.map((id) => ({ id, label: t(`install.platforms.${id}`) }))}
                        onValueChange={setPlatform}
                    />
                )}
                {command ? <CommandBlock command={command} /> : <p className="text-xs text-text-muted">{t('install.install.none')}</p>}
                {((command && run) || install?.guideUrl) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {command && run && (
                            <Button variant="primary" onClick={() => onRun(command)}>
                                <Icon icon={SquareTerminal} size={14} />
                                {t('install.run')}
                            </Button>
                        )}
                        {install?.guideUrl && (
                            <Button href={install.guideUrl}>
                                {t('install.guide')}
                                <Icon icon={ExternalLink} size={14} />
                            </Button>
                        )}
                    </div>
                )}
            </>
        )
    });

    if (extra !== null) {
        steps.push(extra);
    }

    const ways = install?.signIn ?? [];

    steps.push({
        title: t('install.signIn.title'),
        done: provider.installed && signedIn,
        body:
            ways.length === 0 ? (
                <p className="text-xs text-text-muted">{t('install.signIn.unknown')}</p>
            ) : (
                ways.map((way, index) => (
                    <div key={`${way.kind}-${index}`} className="flex min-w-0 flex-col gap-2">
                        {index > 0 && <span className="text-xs font-medium text-text-faint">{t('install.signIn.or')}</span>}
                        <SignInWay way={way} canRun={run !== undefined && provider.installed} onRun={onRun} />
                    </div>
                ))
            )
    });

    steps.push({
        title: t('install.start.title'),
        done: false,
        body: <p className="text-xs text-text-muted">{t('install.start.description', { provider: provider.name })}</p>
    });

    const states = installStepStates(steps.map((step) => step.done));

    return (
        <>
            <header className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken">
                    <CliMark kind={provider.kind} size={20} />
                </span>
                <div className="flex min-w-0 grow flex-col">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-text">{provider.name}</h3>
                        {provider.installed ? (
                            provider.version && (
                                <Pill tone="idle" mono>
                                    {provider.version}
                                </Pill>
                            )
                        ) : (
                            <Pill>{t('install.notInstalled')}</Pill>
                        )}
                    </div>
                    {install && <p className="text-xs text-text-muted">{install.description}</p>}
                </div>
            </header>
            {install ? (
                <ol aria-label={t('install.steps', { provider: provider.name })} className="flex min-w-0 flex-col gap-3">
                    {steps.map((step, index) => (
                        <Step key={index} index={index} state={states[index]!} title={step.title}>
                            {step.body}
                        </Step>
                    ))}
                </ol>
            ) : (
                <p className="text-xs text-text-muted">{t('install.fallback', { provider: provider.name })}</p>
            )}
            <p className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
                <span aria-hidden className={clsx('size-2 shrink-0 rounded-full', provider.installed ? 'bg-status-idle' : 'bg-text-faint')} />
                {provider.installed ? t('install.footer.found') : t('install.footer.missing')}
            </p>
        </>
    );
}
