import { useState, type Ref } from 'react';
import { CircleAlert, CircleCheck, Container, Database, Plus, Trash2, Unplug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, EmptyState, Icon, Menu, messageOf, PromptDialog, Spinner } from '@adecore/ui';
import { DetailHeader, MasterDetail, MasterItem } from '@adecore/ui/settings';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import type { ConnectionConfig, DockerContainer, Engine, ServerInfo } from '../protocol/index.ts';
import { defaultConfig, isValidConfig, targetOf } from './connection-config.ts';
import { ConnectionForm } from './ConnectionForm.tsx';
import { composeNameOf, connectionFromContainer, isMysqlContainer } from './docker.ts';
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
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

type TestOutcome = { readonly config: ConnectionConfig; readonly info: ServerInfo } | { readonly config: ConnectionConfig; readonly error: string };

/* The saved connections beside the form of the one picked, for a settings pane or a view of its own. */
export function ConnectionManager({ value, onValueChange, selected, onSelectedChange, onBrowse, className, ref }: ConnectionManagerProps) {
    const { t } = useTranslation('database');
    const [own, setOwn] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const client = useDatabaseClient();
    const pickedId = selected === undefined ? own : selected;
    const current = value.find((connection) => connection.id === pickedId) ?? value[0] ?? null;

    const select = (id: string | null): void => {
        if (selected === undefined) {
            setOwn(id);
        }
        onSelectedChange?.(id);
    };

    const add = (engine: Engine): void => {
        const connection: Connection = { id: crypto.randomUUID(), name: t('connections.newName'), config: defaultConfig(engine) };
        onValueChange([...value, connection]);
        select(connection.id);
    };

    const addFromContainer = (container: DockerContainer): void => {
        const connection = connectionFromContainer(crypto.randomUUID(), container);
        onValueChange([...value, connection]);
        select(connection.id);
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
        <>
            <Menu.Root>
                <Menu.Trigger render={<Button variant="secondary" size="sm" className="mb-2" />}>
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
            {value.map((connection) => (
                <MasterItem key={connection.id} selected={connection.id === current?.id} onSelect={() => select(connection.id)}>
                    <EngineIcon engine={connection.config.engine} size={16} className="shrink-0 text-text-muted" />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate">{connection.name || t('connections.untitled')}</span>
                        <span className="truncate text-xs text-text-faint">{targetOf(connection)}</span>
                    </span>
                </MasterItem>
            ))}
        </>
    );

    const detail =
        current === null ? (
            <EmptyState icon={Database}>{t('connections.empty')}</EmptyState>
        ) : (
            <>
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
                <ConnectionForm value={current} onValueChange={change} onBrowse={onBrowse} />
                <ConnectionTest key={current.id} connection={current} />
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

    return <MasterDetail ref={ref} className={className} list={list} listWidth={280} listLabel={t('connections.list')} detail={detail} />;
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
                <span className="truncate">{composeNameOf(container) ?? container.name}</span>
                <span className="truncate text-xs text-text-faint">{container.image}</span>
            </span>
        </Menu.Item>
    ));
}

/* The button that asks the server who it is, and what it answered; an answer to an older config is not shown. */
function ConnectionTest({ connection }: { connection: Connection }) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<TestOutcome | null>(null);
    const shown = outcome !== null && outcome.config === connection.config ? outcome : null;

    const test = async (): Promise<void> => {
        const config = connection.config;
        setBusy(true);
        try {
            setOutcome({ config, info: await client.test(config) });
        } catch (e) {
            setOutcome({ config, error: messageOf(e, t('connections.test.failed')) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div>
                <Button variant="secondary" disabled={busy || !isValidConfig(connection.config)} onClick={() => void test()}>
                    {busy ? <Spinner size={14} /> : <Icon icon={Unplug} size={14} />}
                    {t('connections.test.action')}
                </Button>
            </div>
            {shown !== null && 'info' in shown && (
                <Banner
                    icon={CircleCheck}
                    tone="neutral"
                    className="w-full"
                    message={t('connections.test.success', { server: `${t(`engine.flavor.${shown.info.flavor}`)} ${shown.info.version}` })}
                />
            )}
            {shown !== null && 'error' in shown && <Banner icon={CircleAlert} tone="error" className="w-full" message={shown.error} />}
        </div>
    );
}
