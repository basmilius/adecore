import { useState, type Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Container, Network, Plug, RefreshCw, Terminal, type LucideIcon } from 'lucide-react';
import { Button, Field, IconButton, Input, Segmented, Select, Switch, useAsyncAction, type SegmentedOption, type SelectItem } from '@adecore/ui';
import type { Connection } from '../client/types.ts';
import type { DockerContainer, DockerTunnel, MysqlConnectionConfig, MysqlTlsMode, SqliteConnectionConfig, SshTunnel, Engine } from '../protocol/index.ts';
import {
    CONNECT_MODES,
    DEFAULT_HOST,
    DEFAULT_MYSQL_PORT,
    configProblems,
    modeOf,
    withEngine,
    withMode,
    type ConfigProblem,
    type ConnectMode
} from './connection-config.ts';
import { composeNameOf, containerPortOf, isMysqlContainer, publishedPortOf, withContainer } from './docker.ts';
import { ENGINE_ICONS } from './engine-icons.ts';
import { useDockerContainers } from './use-docker-containers.ts';

const TLS_MODES: readonly MysqlTlsMode[] = ['disable', 'prefer', 'require', 'verify'];

const MODE_ICONS: Record<ConnectMode, LucideIcon> = { tcp: Network, socket: Plug, ssh: Terminal, docker: Container };

export interface ConnectionFormProps {
    value: Connection;
    onValueChange(next: Connection): void;
    /* Opens the app's file dialog for a database file or an SSH identity file and resolves with the chosen path, or `null` when the person cancelled. Without it a path is typed. */
    onBrowse?(purpose: 'database' | 'identity'): Promise<string | null>;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* What a field has been left to say; a field nobody touched keeps quiet until it holds something. */
type Touched = ReadonlySet<string>;

interface FieldsProps<Config> {
    config: Config;
    onConfigChange(next: Config): void;
    touched: Touched;
    touch(field: string): void;
}

type Browse = ConnectionFormProps['onBrowse'];

/* A text field that is empty means "not set" for the optional fields of a config. */
const optionalText = (text: string): string | undefined => (text === '' ? undefined : text);

/* One form for one saved connection. Every edit goes out whole through `onValueChange`. */
export function ConnectionForm({ value, onValueChange, onBrowse, className, ref }: ConnectionFormProps) {
    const { t } = useTranslation('database');
    const [touched, setTouched] = useState<Touched>(new Set());
    const config = value.config;
    const options: readonly SegmentedOption<Engine>[] = [
        { id: 'sqlite', label: t('engine.sqlite'), icon: ENGINE_ICONS.sqlite },
        { id: 'mysql', label: t('engine.mysql'), icon: ENGINE_ICONS.mysql }
    ];

    const touch = (field: string): void => {
        setTouched((current) => new Set(current).add(field));
    };

    return (
        <div ref={ref} className={clsx('flex flex-col gap-4', className)}>
            <Field label={t('connections.form.name')} orientation="horizontal">
                <Input value={value.name} placeholder={t('connections.untitled')} onChange={(e) => onValueChange({ ...value, name: e.target.value })} />
            </Field>
            <Field label={t('connections.form.engine')} orientation="horizontal" group>
                <Segmented
                    value={config.engine}
                    label={t('connections.form.engine')}
                    options={options}
                    onValueChange={(engine) => {
                        onValueChange(withEngine(value, engine));
                        setTouched(new Set());
                    }}
                />
            </Field>
            {config.engine === 'sqlite' ? (
                <SqliteFields
                    config={config}
                    onConfigChange={(next) => onValueChange({ ...value, config: next })}
                    touched={touched}
                    touch={touch}
                    onBrowse={onBrowse}
                />
            ) : (
                <MysqlFields
                    config={config}
                    onConfigChange={(next) => onValueChange({ ...value, config: next })}
                    touched={touched}
                    touch={touch}
                    onBrowse={onBrowse}
                />
            )}
            <Field label={t('connections.form.readOnly')} hint={t('connections.form.readOnlyHint')} orientation="horizontal" group>
                <Switch
                    checked={config.readOnly === true}
                    label={t('connections.form.readOnly')}
                    onCheckedChange={(readOnly) => onValueChange({ ...value, config: { ...config, readOnly } })}
                />
            </Field>
        </div>
    );
}

/* The sentence for a problem, once the field has something to answer for. */
function useProblem(problem: ConfigProblem | undefined, field: string, touched: Touched, filled: boolean): string | undefined {
    const { t } = useTranslation('database');
    if (problem === undefined || !(touched.has(field) || filled)) {
        return undefined;
    }
    return t(`connections.form.problems.${problem}`);
}

function SqliteFields({ config, onConfigChange, touched, touch, onBrowse }: FieldsProps<SqliteConnectionConfig> & { onBrowse: Browse }) {
    const { t } = useTranslation('database');
    const browsing = useAsyncAction();
    const problem = configProblems(config).path;
    const error = useProblem(problem, 'path', touched, config.path !== '') ?? browsing.failure ?? undefined;

    const browse = async (): Promise<void> => {
        await browsing.run(async () => {
            const picked = await onBrowse?.('database');
            if (picked !== null && picked !== undefined) {
                onConfigChange({ ...config, path: picked });
            }
        });
        touch('path');
    };

    return (
        <>
            <Field
                label={t('connections.form.path')}
                hint={t('connections.form.pathHint')}
                error={error}
                orientation="horizontal"
                group={onBrowse !== undefined}
            >
                <PathInput
                    value={config.path}
                    placeholder="/path/to/database.sqlite"
                    label={t('connections.form.path')}
                    busy={browsing.busy}
                    onBlur={() => touch('path')}
                    onValueChange={(path) => onConfigChange({ ...config, path })}
                    onBrowse={onBrowse === undefined ? undefined : () => void browse()}
                />
            </Field>
            <Field label={t('connections.form.create')} hint={t('connections.form.createHint')} orientation="horizontal" group>
                <Switch
                    checked={config.create === true}
                    label={t('connections.form.create')}
                    onCheckedChange={(create) => onConfigChange({ ...config, create })}
                />
            </Field>
        </>
    );
}

/* A path typed by hand, with a Browse button beside it when the app has a file dialog. */
function PathInput({
    value,
    placeholder,
    label,
    busy,
    onBlur,
    onValueChange,
    onBrowse
}: {
    value: string;
    placeholder: string;
    label: string;
    busy: boolean;
    onBlur?: () => void;
    onValueChange(path: string): void;
    onBrowse: (() => void) | undefined;
}) {
    const { t } = useTranslation('database');

    return (
        <div className="flex items-center gap-2">
            <Input
                mono
                value={value}
                placeholder={placeholder}
                spellCheck={false}
                aria-label={onBrowse === undefined ? undefined : label}
                onBlur={onBlur}
                onChange={(e) => onValueChange(e.target.value)}
            />
            {onBrowse !== undefined && (
                <Button variant="secondary" disabled={busy} onClick={onBrowse}>
                    {t('connections.form.browse')}
                </Button>
            )}
        </div>
    );
}

function PortField({
    label,
    hint,
    error,
    value,
    placeholder,
    onBlur,
    onValueChange
}: {
    label: string;
    hint?: string;
    error: string | undefined;
    value: number | undefined;
    placeholder: number;
    onBlur?: () => void;
    onValueChange(port: number | undefined): void;
}) {
    return (
        <Field label={label} hint={hint} error={error} orientation="horizontal">
            <Input
                type="number"
                min={1}
                max={65535}
                className="max-w-32"
                value={value === undefined ? '' : String(value)}
                placeholder={String(placeholder)}
                onBlur={onBlur}
                onChange={(e) => onValueChange(e.target.value === '' ? undefined : Number(e.target.value))}
            />
        </Field>
    );
}

function MysqlFields({ config, onConfigChange, touched, touch, onBrowse }: FieldsProps<MysqlConnectionConfig> & { onBrowse: Browse }) {
    const { t } = useTranslation('database');
    const mode = modeOf(config);
    const tunnel = config.tunnel;
    const modes: readonly SegmentedOption<ConnectMode>[] = CONNECT_MODES.map((id) => ({ id, label: t(`connections.form.mode.${id}`), icon: MODE_ICONS[id] }));
    const tlsItems: SelectItem<MysqlTlsMode>[] = TLS_MODES.map((tls) => ({
        value: tls,
        label: t(`connections.form.tls.${tls}`),
        description: t(`connections.form.tls.${tls}Hint`)
    }));

    return (
        <>
            <Field label={t('connections.form.mode.label')} orientation="horizontal" group>
                <Segmented
                    value={mode}
                    label={t('connections.form.mode.label')}
                    options={modes}
                    onValueChange={(next) => onConfigChange(withMode(config, next))}
                />
            </Field>
            {mode === 'tcp' && <ServerFields config={config} onConfigChange={onConfigChange} touched={touched} touch={touch} />}
            {mode === 'socket' && <SocketField config={config} onConfigChange={onConfigChange} touched={touched} touch={touch} />}
            {tunnel?.kind === 'ssh' && (
                <SshFields config={config} tunnel={tunnel} onConfigChange={onConfigChange} touched={touched} touch={touch} onBrowse={onBrowse} />
            )}
            {tunnel?.kind === 'docker' && <DockerFields config={config} tunnel={tunnel} onConfigChange={onConfigChange} touched={touched} touch={touch} />}
            <Field label={t('connections.form.user')} orientation="horizontal">
                <Input value={config.user} autoComplete="off" spellCheck={false} onChange={(e) => onConfigChange({ ...config, user: e.target.value })} />
            </Field>
            <Field label={t('connections.form.password')} orientation="horizontal">
                <Input
                    type="password"
                    value={config.password ?? ''}
                    autoComplete="off"
                    onChange={(e) => onConfigChange({ ...config, password: optionalText(e.target.value) })}
                />
            </Field>
            <Field label={t('connections.form.database')} hint={t('connections.form.databaseHint')} orientation="horizontal">
                <Input
                    value={config.database ?? ''}
                    spellCheck={false}
                    onChange={(e) => onConfigChange({ ...config, database: optionalText(e.target.value) })}
                />
            </Field>
            <Field label={t('connections.form.tls.label')} orientation="horizontal" group>
                <Select
                    value={config.tls ?? 'prefer'}
                    label={t('connections.form.tls.label')}
                    items={tlsItems}
                    onValueChange={(tls) => onConfigChange({ ...config, tls })}
                />
            </Field>
        </>
    );
}

/* The host and the port of a server reached directly, or, through SSH, as the SSH host sees it. */
function ServerFields({ config, onConfigChange, touched, touch }: FieldsProps<MysqlConnectionConfig>) {
    const { t } = useTranslation('database');
    const problems = configProblems(config);
    const viaSsh = config.tunnel?.kind === 'ssh';
    const hostError = useProblem(problems.host, 'host', touched, config.host !== '');
    const portError = useProblem(problems.port, 'port', touched, config.port !== undefined);

    return (
        <>
            <Field
                label={t(viaSsh ? 'connections.form.ssh.serverHost' : 'connections.form.host')}
                hint={viaSsh ? t('connections.form.ssh.serverHint') : undefined}
                error={hostError}
                orientation="horizontal"
            >
                <Input
                    value={config.host}
                    placeholder={DEFAULT_HOST}
                    spellCheck={false}
                    onBlur={() => touch('host')}
                    onChange={(e) => onConfigChange({ ...config, host: e.target.value })}
                />
            </Field>
            <PortField
                label={t(viaSsh ? 'connections.form.ssh.serverPort' : 'connections.form.port')}
                error={portError}
                value={config.port}
                placeholder={DEFAULT_MYSQL_PORT}
                onBlur={() => touch('port')}
                onValueChange={(port) => onConfigChange({ ...config, port })}
            />
        </>
    );
}

function SocketField({ config, onConfigChange, touched, touch }: FieldsProps<MysqlConnectionConfig>) {
    const { t } = useTranslation('database');
    const error = useProblem(configProblems(config).socket, 'socket', touched, (config.socket ?? '') !== '');

    return (
        <Field label={t('connections.form.socket')} hint={t('connections.form.socketHint')} error={error} orientation="horizontal">
            <Input
                mono
                value={config.socket ?? ''}
                placeholder="/tmp/mysql.sock"
                spellCheck={false}
                onBlur={() => touch('socket')}
                onChange={(e) => onConfigChange({ ...config, socket: e.target.value })}
            />
        </Field>
    );
}

function SshFields({ config, tunnel, onConfigChange, touched, touch, onBrowse }: FieldsProps<MysqlConnectionConfig> & { tunnel: SshTunnel; onBrowse: Browse }) {
    const { t } = useTranslation('database');
    const browsing = useAsyncAction();
    const problems = configProblems(config);
    const hostError = useProblem(problems.sshHost, 'sshHost', touched, tunnel.host !== '');
    const portError = useProblem(problems.sshPort, 'sshPort', touched, tunnel.port !== undefined);
    const update = (patch: Partial<SshTunnel>): void => onConfigChange({ ...config, tunnel: { ...tunnel, ...patch } });

    const browse = async (): Promise<void> => {
        await browsing.run(async () => {
            const picked = await onBrowse?.('identity');
            if (picked !== null && picked !== undefined) {
                update({ identityFile: picked });
            }
        });
    };

    return (
        <>
            <Field label={t('connections.form.ssh.host')} hint={t('connections.form.ssh.hostHint')} error={hostError} orientation="horizontal">
                <Input
                    value={tunnel.host}
                    placeholder="bastion.example.com"
                    spellCheck={false}
                    onBlur={() => touch('sshHost')}
                    onChange={(e) => update({ host: e.target.value })}
                />
            </Field>
            <PortField
                label={t('connections.form.ssh.port')}
                error={portError}
                value={tunnel.port}
                placeholder={22}
                onBlur={() => touch('sshPort')}
                onValueChange={(port) => update({ port })}
            />
            <Field label={t('connections.form.ssh.user')} orientation="horizontal">
                <Input value={tunnel.user ?? ''} autoComplete="off" spellCheck={false} onChange={(e) => update({ user: optionalText(e.target.value) })} />
            </Field>
            <Field
                label={t('connections.form.ssh.identityFile')}
                hint={t('connections.form.ssh.keyHint')}
                error={browsing.failure ?? undefined}
                orientation="horizontal"
                group={onBrowse !== undefined}
            >
                <PathInput
                    value={tunnel.identityFile ?? ''}
                    placeholder="~/.ssh/id_ed25519"
                    label={t('connections.form.ssh.identityFile')}
                    busy={browsing.busy}
                    onValueChange={(identityFile) => update({ identityFile: optionalText(identityFile) })}
                    onBrowse={onBrowse === undefined ? undefined : () => void browse()}
                />
            </Field>
            <ServerFields config={config} onConfigChange={onConfigChange} touched={touched} touch={touch} />
        </>
    );
}

/* What a container offers a person in a list: its image, its Compose name and the port it publishes. */
function containerDescription(container: DockerContainer, published: string): string {
    return [container.image, composeNameOf(container), published].filter((part) => part !== null).join(' \u00b7 ');
}

function DockerFields({ config, tunnel, onConfigChange, touched, touch }: FieldsProps<MysqlConnectionConfig> & { tunnel: DockerTunnel }) {
    const { t } = useTranslation('database');
    const docker = useDockerContainers();
    const problems = configProblems(config);
    const containers = docker.state.status === 'ready' ? docker.state.containers.filter(isMysqlContainer) : [];
    const picked = containers.find((container) => container.name === tunnel.container);
    const containerError = useProblem(problems.container, 'container', touched, tunnel.container !== '');
    const portError = useProblem(problems.containerPort, 'containerPort', touched, tunnel.port !== undefined);

    const publishedText = (container: DockerContainer, port: number): string => {
        const host = publishedPortOf(container, port);
        return host === null ? t('connections.form.docker.notPublished') : t('connections.form.docker.published', { port: host });
    };

    const items: SelectItem<string>[] = containers.map((container) => ({
        value: container.name,
        label: container.name,
        description: containerDescription(container, publishedText(container, containerPortOf(container)))
    }));
    if (tunnel.container !== '' && picked === undefined) {
        items.unshift({ value: tunnel.container, label: tunnel.container, description: t('connections.form.docker.notRunning') });
    }

    const status = ((): { hint?: string; error?: string } => {
        switch (docker.state.status) {
            case 'loading':
                return { hint: t('connections.form.docker.loading') };
            case 'unsupported':
                return { hint: `${t('connections.form.docker.unsupported')} ${docker.state.message}` };
            case 'error':
                return { error: docker.state.message };
            case 'ready':
                return containers.length === 0 ? { hint: t('connections.form.docker.empty') } : {};
        }
    })();

    const pick = (name: string): void => {
        const container = containers.find((candidate) => candidate.name === name);
        if (container !== undefined) {
            onConfigChange(withContainer(config, container));
        }
    };

    return (
        <>
            <Field label={t('connections.form.docker.container')} hint={status.hint} error={status.error ?? containerError} orientation="horizontal" group>
                <div className="flex items-center gap-2">
                    <Select
                        value={tunnel.container === '' ? null : tunnel.container}
                        label={t('connections.form.docker.container')}
                        placeholder={t('connections.form.docker.pick')}
                        items={items}
                        truncateValue
                        disabled={items.length === 0}
                        onValueChange={pick}
                    />
                    <IconButton
                        icon={RefreshCw}
                        label={t('connections.form.docker.refresh')}
                        busy={docker.state.status === 'loading'}
                        onClick={docker.reload}
                        onBlur={() => touch('container')}
                    />
                </div>
            </Field>
            <PortField
                label={t('connections.form.docker.port')}
                hint={picked === undefined ? undefined : publishedText(picked, tunnel.port ?? DEFAULT_MYSQL_PORT)}
                error={portError}
                value={tunnel.port}
                placeholder={DEFAULT_MYSQL_PORT}
                onBlur={() => touch('containerPort')}
                onValueChange={(port) => onConfigChange({ ...config, tunnel: { ...tunnel, port } })}
            />
        </>
    );
}
