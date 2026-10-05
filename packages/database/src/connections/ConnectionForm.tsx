import { useState, type Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Segmented, Select, Switch, useAsyncAction, type SegmentedOption, type SelectItem } from '@adecore/ui';
import type { Connection } from '../client/types.ts';
import type { MysqlConnectionConfig, MysqlTlsMode, SqliteConnectionConfig, Engine } from '../protocol/index.ts';
import { DEFAULT_MYSQL_PORT, configProblems, withEngine, type ConfigProblem } from './connection-config.ts';
import { ENGINE_ICONS } from './engine-icons.ts';

const TLS_MODES: readonly MysqlTlsMode[] = ['disable', 'prefer', 'require', 'verify'];

export interface ConnectionFormProps {
    value: Connection;
    onValueChange(next: Connection): void;
    /* Opens the app's file dialog and resolves with the chosen path, or `null` when the person cancelled. Without it the path is typed. */
    onBrowse?(): Promise<string | null>;
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
                <MysqlFields config={config} onConfigChange={(next) => onValueChange({ ...value, config: next })} touched={touched} touch={touch} />
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

function SqliteFields({
    config,
    onConfigChange,
    touched,
    touch,
    onBrowse
}: FieldsProps<SqliteConnectionConfig> & { onBrowse: ConnectionFormProps['onBrowse'] }) {
    const { t } = useTranslation('database');
    const browsing = useAsyncAction();
    const problem = configProblems(config).path;
    const error = useProblem(problem, 'path', touched, config.path !== '') ?? browsing.failure ?? undefined;

    const browse = async (): Promise<void> => {
        await browsing.run(async () => {
            const picked = await onBrowse?.();
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
                <div className="flex items-center gap-2">
                    <Input
                        mono
                        value={config.path}
                        placeholder="/path/to/database.sqlite"
                        spellCheck={false}
                        aria-label={onBrowse === undefined ? undefined : t('connections.form.path')}
                        onBlur={() => touch('path')}
                        onChange={(e) => onConfigChange({ ...config, path: e.target.value })}
                    />
                    {onBrowse !== undefined && (
                        <Button variant="secondary" disabled={browsing.busy} onClick={() => void browse()}>
                            {t('connections.form.browse')}
                        </Button>
                    )}
                </div>
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

function MysqlFields({ config, onConfigChange, touched, touch }: FieldsProps<MysqlConnectionConfig>) {
    const { t } = useTranslation('database');
    const problems = configProblems(config);
    const hostError = useProblem(problems.host, 'host', touched, config.host !== '');
    const portError = useProblem(problems.port, 'port', touched, config.port !== undefined);
    const tlsItems: SelectItem<MysqlTlsMode>[] = TLS_MODES.map((mode) => ({
        value: mode,
        label: t(`connections.form.tls.${mode}`),
        description: t(`connections.form.tls.${mode}Hint`)
    }));

    return (
        <>
            <Field label={t('connections.form.host')} error={hostError} orientation="horizontal">
                <Input
                    value={config.host}
                    placeholder="127.0.0.1"
                    spellCheck={false}
                    onBlur={() => touch('host')}
                    onChange={(e) => onConfigChange({ ...config, host: e.target.value })}
                />
            </Field>
            <Field label={t('connections.form.port')} error={portError} orientation="horizontal">
                <Input
                    type="number"
                    min={1}
                    max={65535}
                    className="max-w-32"
                    value={config.port === undefined ? '' : String(config.port)}
                    placeholder={String(DEFAULT_MYSQL_PORT)}
                    onBlur={() => touch('port')}
                    onChange={(e) => onConfigChange({ ...config, port: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
            </Field>
            <Field label={t('connections.form.socket')} hint={t('connections.form.socketHint')} orientation="horizontal">
                <Input
                    mono
                    value={config.socket ?? ''}
                    placeholder="/tmp/mysql.sock"
                    spellCheck={false}
                    onChange={(e) => onConfigChange({ ...config, socket: optionalText(e.target.value) })}
                />
            </Field>
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
