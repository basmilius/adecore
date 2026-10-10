import { useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, CircleCheck, Container, Database, Plus, Trash2, Unplug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, CloseButton, EmptyState, Icon, Menu, messageOf, PromptDialog, Spinner } from '@adecore/ui';
import { DetailHeader, MasterItem } from '@adecore/ui/settings';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import type { ConnectionConfig, DockerContainer, Engine, ServerInfo } from '../protocol/index.ts';
import { defaultConfig, isValidConfig, targetOf } from './connection-config.ts';
import { ConnectionForm } from './ConnectionForm.tsx';
import { connectionFromContainer, containerTitle, isMysqlContainer } from './docker.ts';
import { useDockerContainers } from './use-docker-containers.ts';
import { ENGINE_ICONS } from './engine-icons.ts';
import { EngineIcon } from './EngineIcon.tsx';

const ENGINES: readonly Engine[] = ['sqlite', 'mysql'];

export interface ConnectionManagerProps {
    value: readonly Connection[];
    /* Saving is the app's: every add, edit and delete goes out whole through here. */
    onValueChange(next: readonly Connection[]): void;
    /* The id of the connection in the detail. Without it the manager keeps the selection itself; `null` is none. */
    selected?: string | null;
    onSelectedChange?(id: string | null): void;
    /* Opens the app's file dialog for a database file or an SSH identity file; without it the path is typed. See `ConnectionForm`. */
    onBrowse?(purpose: 'database' | 'identity'): Promise<string | null>;
    /* The app's own settings of the picked connection, drawn after the form's fields and in their rhythm, such as a horizontal `Field`. */
    renderFields?(connection: Connection): ReactNode;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* What the server answered a test, for the connection and the config that were tested. */
type TestOutcome = { readonly connectionId: string; readonly config: ConnectionConfig } & ({ readonly info: ServerInfo } | { readonly error: string });

/*
 * The saved connections beside the form of the one picked, for a dialog, a settings pane or a view of its own. The list
 * scrolls on its own with New connection under it, and the detail scrolls beside it; in a narrow window they stack.
 */
export function ConnectionManager({ value, onValueChange, selected, onSelectedChange, onBrowse, renderFields, className, ref }: ConnectionManagerProps) {
    const { t } = useTranslation('database');
    const [own, setOwn] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [outcome, setOutcome] = useState<TestOutcome | null>(null);
    const client = useDatabaseClient();
    const pickedId = selected === undefined ? own : selected;
    const current = value.find((connection) => connection.id === pickedId) ?? value[0] ?? null;
    // The answer of one connection is gone once another is picked, so coming back does not bring it back.
    if (outcome !== null && outcome.connectionId !== current?.id) {
        setOutcome(null);
    }
    // An answer to an older config is never shown for a newer one.
    const shown = outcome !== null && current !== null && outcome.config === current.config ? outcome : null;

    const select = (id: string | null): void => {
        if (selected === undefined) {
            setOwn(id);
        }
        onSelectedChange?.(id);
    };

    const append = (connection: Connection): void => {
        onValueChange([...value, connection]);
        select(connection.id);
    };

    const add = (engine: Engine): void => {
        append({ id: crypto.randomUUID(), name: t('connections.newName'), config: defaultConfig(engine) });
    };

    const addFromContainer = (container: DockerContainer): void => {
        append(connectionFromContainer(crypto.randomUUID(), container));
    };

    const change = (next: Connection): void => {
        onValueChange(value.map((connection) => (connection.id === next.id ? next : connection)));
    };

    const remove = async (connection: Connection): Promise<void> => {
        await client.disconnect(connection.id).catch(() => undefined);
        const index = value.findIndex((entry) => entry.id === connection.id);
        const rest = value.filter((entry) => entry.id !== connection.id);
        onValueChange(rest);
        select(rest[Math.min(index, rest.length - 1)]?.id ?? null);
    };

    const list = (
        <div className="flex w-56 shrink-0 flex-col border-r border-border max-[640px]:max-h-60 max-[640px]:w-auto max-[640px]:border-r-0 max-[640px]:border-b">
            <nav aria-label={t('connections.list')} className="flex min-h-0 grow flex-col gap-0.5 overflow-y-auto p-2">
                {value.length === 0 && <p className="px-2 py-1.5 text-xs text-text-faint">{t('connections.empty')}</p>}
                {value.map((connection) => (
                    <MasterItem key={connection.id} selected={connection.id === current?.id} onSelect={() => select(connection.id)}>
                        <EngineIcon engine={connection.config.engine} size={16} className="shrink-0 text-text-muted" />
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate">{connection.name || t('connections.untitled')}</span>
                            <span className="truncate text-xs text-text-faint">{targetOf(connection)}</span>
                        </span>
                    </MasterItem>
                ))}
            </nav>
            <div className="flex shrink-0 flex-col gap-1 border-t border-border p-2">
                <Menu.Root>
                    <Menu.Trigger render={<Button variant="ghost" size="sm" className="justify-start" />}>
                        <Icon icon={Plus} size={14} />
                        {t('connections.new')}
                    </Menu.Trigger>
                    <Menu.Popup>
                        {ENGINES.map((engine) => (
                            <Menu.Item key={engine} onClick={() => add(engine)}>
                                <Icon icon={ENGINE_ICONS[engine]} size={14} />
                                {t(`engine.${engine}`)}
                            </Menu.Item>
                        ))}
                        <Menu.Separator />
                        <Menu.SubmenuRoot>
                            <Menu.SubmenuTrigger>
                                <Icon icon={Container} size={14} />
                                {t('connections.fromDocker.label')}
                            </Menu.SubmenuTrigger>
                            <Menu.Popup>
                                <DockerMenuItems onPick={addFromContainer} />
                            </Menu.Popup>
                        </Menu.SubmenuRoot>
                    </Menu.Popup>
                </Menu.Root>
            </div>
        </div>
    );

    const detail =
        current === null ? (
            <EmptyState icon={Database}>{t('connections.empty')}</EmptyState>
        ) : (
            <>
                {shown !== null && (
                    <Banner
                        icon={'info' in shown ? CircleCheck : CircleAlert}
                        tone={'info' in shown ? 'neutral' : 'error'}
                        className="sticky top-0 z-10"
                        message={
                            'info' in shown
                                ? t('connections.test.success', { server: `${t(`engine.flavor.${shown.info.flavor}`)} ${shown.info.version}` })
                                : shown.error
                        }
                    >
                        <CloseButton size="sm" label={t('connections.test.dismiss')} onClick={() => setOutcome(null)} />
                    </Banner>
                )}
                <DetailHeader
                    mark={<EngineIcon engine={current.config.engine} size={20} className="mt-0.5 shrink-0 text-text-muted" />}
                    title={current.name || t('connections.untitled')}
                    subtitle={targetOf(current)}
                    actions={
                        <Button variant="danger-outline" onClick={() => setDeleting(true)}>
                            <Icon icon={Trash2} size={14} />
                            {t('connections.delete.action')}
                        </Button>
                    }
                />
                <div className="flex flex-col gap-4">
                    <ConnectionForm value={current} onValueChange={change} onBrowse={onBrowse} />
                    {renderFields?.(current)}
                </div>
                <ConnectionTest key={current.id} connection={current} onOutcome={setOutcome} />
                <PromptDialog
                    open={deleting}
                    danger
                    onOpenChange={setDeleting}
                    title={t('connections.delete.title')}
                    description={t('connections.delete.description', { name: current.name || t('connections.untitled') })}
                    confirmLabel={t('connections.delete.confirm')}
                    onConfirm={async () => {
                        await remove(current);
                        setDeleting(false);
                    }}
                />
            </>
        );

    return (
        <div ref={ref} className={clsx('flex min-h-0 min-w-0 grow max-[640px]:flex-col', className)}>
            {list}
            <div className="min-h-0 min-w-0 grow overflow-y-auto">
                <div className="flex min-w-0 flex-col gap-6 px-5 py-4">{detail}</div>
            </div>
        </div>
    );
}

/* The containers Docker is running as menu items. The submenu mounts this when it opens, so Docker is asked only then. */
function DockerMenuItems({ onPick }: { onPick(container: DockerContainer): void }) {
    const { t } = useTranslation('database');
    const { state, reload } = useDockerContainers();
    if (state.status === 'loading') {
        return (
            <Menu.Label className="flex items-center gap-2">
                <Spinner size={12} />
                {t('connections.fromDocker.loading')}
            </Menu.Label>
        );
    }
    if (state.status !== 'ready') {
        return (
            <>
                <Menu.Label className="max-w-64 break-words">
                    {state.status === 'unsupported' ? `${t('connections.fromDocker.unsupported')} ${state.message}` : state.message}
                </Menu.Label>
                <Menu.Item closeOnClick={false} onClick={reload}>
                    {t('connections.fromDocker.retry')}
                </Menu.Item>
            </>
        );
    }
    const containers = state.containers.filter(isMysqlContainer);
    if (containers.length === 0) {
        return <Menu.Label>{t('connections.fromDocker.empty')}</Menu.Label>;
    }
    return containers.map((container) => (
        <Menu.Item key={container.id} onClick={() => onPick(container)}>
            <span className="flex min-w-0 flex-col">
                <span className="truncate">{containerTitle(container)}</span>
                <span className="truncate text-xs text-text-faint">{container.image}</span>
            </span>
        </Menu.Item>
    ));
}

/* The button that asks the server who it is. The manager shows the answer at the top of the detail. */
function ConnectionTest({ connection, onOutcome }: { connection: Connection; onOutcome(outcome: TestOutcome): void }) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const [busy, setBusy] = useState(false);

    const test = async (): Promise<void> => {
        const config = connection.config;
        setBusy(true);
        try {
            onOutcome({ connectionId: connection.id, config, info: await client.test(config) });
        } catch (e) {
            onOutcome({ connectionId: connection.id, config, error: messageOf(e, t('connections.test.failed')) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <Button variant="secondary" disabled={busy || !isValidConfig(connection.config)} onClick={() => void test()}>
                {busy ? <Spinner size={14} /> : <Icon icon={Unplug} size={14} />}
                {t('connections.test.action')}
            </Button>
        </div>
    );
}
