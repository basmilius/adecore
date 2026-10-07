import { useEffect, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, Copy, KeyRound, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, EmptyState, Icon, Pill, Spinner, Tabs, copyText, messageOf } from '@adecore/ui';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import { CODE_TEXT } from '../code-text.ts';
import type { ColumnInfo, ForeignKeyInfo, IndexInfo, TableStructure } from '../protocol/index.ts';
import { useSchemaChange } from '../use-schema-change.ts';
import { referenceOf } from './structure-text.ts';

export interface StructureViewProps {
    connection: Connection;
    schema: string;
    table: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

type Load =
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string }
    | { readonly status: 'ready'; readonly structure: TableStructure };

/* What a load answered, with the request it answered, so an answer to an earlier request is never taken for this one. */
interface Answer {
    readonly connection: Connection;
    readonly schema: string;
    readonly table: string;
    readonly attempt: number;
    readonly load: Load;
}

const TH = 'sticky top-0 h-7 bg-surface px-3 text-left text-xs font-medium whitespace-nowrap text-text-faint';
const TD = 'h-7 border-t border-border-soft px-3 text-xs whitespace-nowrap text-text select-text';
const MONO = CODE_TEXT;

/* The columns, indexes, foreign keys and DDL of one table or view. */
export function StructureView({ connection, schema, table, className, ref }: StructureViewProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [attempt, setAttempt] = useState(0);
    // A schema change reloads without leaving the structure on screen: the answer keeps its place until the new one arrives.
    const [reloads, setReloads] = useState(0);
    const answered = answer !== null && answer.connection === connection && answer.schema === schema && answer.table === table && answer.attempt === attempt;
    const load: Load = answered ? answer.load : { status: 'loading' };

    useSchemaChange(connection.id, schema, () => setReloads((now) => now + 1));

    useEffect(() => {
        let current = true;
        const settle = (outcome: Load): void => {
            if (current) {
                setAnswer({ connection, schema, table, attempt, load: outcome });
            }
        };
        client
            .session(connection)
            .structure(schema, table)
            .then(
                (structure) => settle({ status: 'ready', structure }),
                (e: unknown) => settle({ status: 'error', message: messageOf(e, t('structure.failed')) })
            );
        return () => {
            current = false;
        };
    }, [client, connection, schema, table, attempt, reloads, t]);

    return (
        <div ref={ref} className={clsx('flex min-h-0 min-w-0 flex-col', className)}>
            {load.status === 'loading' && (
                <div className="grid grow place-items-center py-8 text-text-muted">
                    <Spinner size={20} label={t('structure.loading')} />
                </div>
            )}
            {load.status === 'error' && (
                <div className="p-3">
                    <Banner icon={CircleAlert} tone="error" className="w-full" message={load.message}>
                        <Button variant="secondary" size="sm" onClick={() => setAttempt(attempt + 1)}>
                            {t('structure.retry')}
                        </Button>
                    </Banner>
                </div>
            )}
            {load.status === 'ready' && <StructureTabs structure={load.structure} />}
        </div>
    );
}

export function StructureTabs({ structure }: { structure: TableStructure }) {
    const { t } = useTranslation('database');
    return (
        <Tabs.Root defaultValue="columns" className="flex min-h-0 grow flex-col">
            <Tabs.List className="shrink-0 px-3">
                <Tabs.Tab value="columns">
                    {t('structure.columns')}
                    <Tabs.Count value={structure.columns.length} />
                </Tabs.Tab>
                <Tabs.Tab value="indexes">
                    {t('structure.indexes')}
                    <Tabs.Count value={structure.indexes.length} />
                </Tabs.Tab>
                <Tabs.Tab value="foreignKeys">
                    {t('structure.foreignKeys')}
                    <Tabs.Count value={structure.foreignKeys.length} />
                </Tabs.Tab>
                <Tabs.Tab value="ddl">{t('structure.ddl')}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="columns" className="min-h-0 grow overflow-auto">
                <ColumnsTable structure={structure} />
            </Tabs.Panel>
            <Tabs.Panel value="indexes" className="min-h-0 grow overflow-auto">
                <IndexesTable indexes={structure.indexes} />
            </Tabs.Panel>
            <Tabs.Panel value="foreignKeys" className="min-h-0 grow overflow-auto">
                <ForeignKeysTable foreignKeys={structure.foreignKeys} />
            </Tabs.Panel>
            <Tabs.Panel value="ddl" className="min-h-0 grow overflow-auto">
                <Ddl ddl={structure.ddl} />
            </Tabs.Panel>
        </Tabs.Root>
    );
}

function Grid({ heads, children }: { heads: readonly string[]; children: ReactNode }) {
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    {heads.map((head) => (
                        <th key={head} scope="col" className={TH}>
                            {head}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    );
}

function YesNo({ value }: { value: boolean }) {
    const { t } = useTranslation('database');
    return <>{value ? t('structure.yes') : t('structure.no')}</>;
}

function ColumnsTable({ structure }: { structure: TableStructure }) {
    const { t } = useTranslation('database');
    const heads = [
        t('structure.column.name'),
        t('structure.column.type'),
        t('structure.column.nullable'),
        t('structure.column.default'),
        t('structure.column.extra'),
        t('structure.column.comment')
    ];
    const foreign = new Set(structure.foreignKeys.flatMap((key) => key.columns));
    if (structure.columns.length === 0) {
        return <EmptyState>{t('structure.noColumns')}</EmptyState>;
    }
    return (
        <Grid heads={heads}>
            {structure.columns.map((column) => (
                <ColumnRow key={column.name} column={column} primary={structure.primaryKey.includes(column.name)} foreign={foreign.has(column.name)} />
            ))}
        </Grid>
    );
}

function ColumnRow({ column, primary, foreign }: { column: ColumnInfo; primary: boolean; foreign: boolean }) {
    const { t } = useTranslation('database');
    return (
        <tr>
            <td className={TD}>
                <span className="flex items-center gap-1.5">
                    {primary ? (
                        <Icon icon={KeyRound} size={12} className="shrink-0 text-status-needs-you" />
                    ) : foreign ? (
                        <Icon icon={Link2} size={12} className="shrink-0 text-text-muted" />
                    ) : (
                        <span className="size-3 shrink-0" />
                    )}
                    {column.name}
                </span>
            </td>
            <td className={clsx(TD, MONO)}>{column.type}</td>
            <td className={clsx(TD, 'text-text-muted')}>
                <YesNo value={column.nullable} />
            </td>
            <td className={clsx(TD, MONO)}>{column.defaultValue}</td>
            <td className={TD}>
                <span className="flex gap-1">
                    {column.autoIncrement && <Pill>{t('structure.autoIncrement')}</Pill>}
                    {column.generated && <Pill>{t('structure.generated')}</Pill>}
                </span>
            </td>
            <td className={clsx(TD, 'text-text-muted')}>{column.comment}</td>
        </tr>
    );
}

function IndexesTable({ indexes }: { indexes: readonly IndexInfo[] }) {
    const { t } = useTranslation('database');
    if (indexes.length === 0) {
        return <EmptyState>{t('structure.noIndexes')}</EmptyState>;
    }
    return (
        <Grid heads={[t('structure.index.name'), t('structure.index.columns'), t('structure.index.kind')]}>
            {indexes.map((index) => (
                <tr key={index.name}>
                    <td className={TD}>{index.name}</td>
                    <td className={clsx(TD, MONO)}>{index.columns.join(', ')}</td>
                    <td className={TD}>
                        <span className="flex gap-1">
                            {index.primary && <Pill tone="accent">{t('structure.primary')}</Pill>}
                            {index.unique && !index.primary && <Pill>{t('structure.unique')}</Pill>}
                        </span>
                    </td>
                </tr>
            ))}
        </Grid>
    );
}

function ForeignKeysTable({ foreignKeys }: { foreignKeys: readonly ForeignKeyInfo[] }) {
    const { t } = useTranslation('database');
    if (foreignKeys.length === 0) {
        return <EmptyState>{t('structure.noForeignKeys')}</EmptyState>;
    }
    const action = (value: string | null): string => value ?? t('structure.engineDefault');
    return (
        <Grid
            heads={[
                t('structure.foreignKey.name'),
                t('structure.foreignKey.columns'),
                t('structure.foreignKey.references'),
                t('structure.foreignKey.onUpdate'),
                t('structure.foreignKey.onDelete')
            ]}
        >
            {foreignKeys.map((key, i) => (
                <tr key={key.name ?? i}>
                    <td className={TD}>{key.name}</td>
                    <td className={clsx(TD, MONO)}>{key.columns.join(', ')}</td>
                    <td className={clsx(TD, MONO)}>{referenceOf(key)}</td>
                    <td className={clsx(TD, 'text-text-muted')}>{action(key.onUpdate)}</td>
                    <td className={clsx(TD, 'text-text-muted')}>{action(key.onDelete)}</td>
                </tr>
            ))}
        </Grid>
    );
}

function Ddl({ ddl }: { ddl: string | null }) {
    const { t } = useTranslation('database');
    if (ddl === null) {
        return <EmptyState>{t('structure.noDdl')}</EmptyState>;
    }
    return (
        <div className="relative">
            <Button variant="secondary" size="xs" className="absolute top-2 right-3" onClick={() => copyText(ddl)}>
                <Icon icon={Copy} size={12} />
                {t('structure.copy')}
            </Button>
            <pre className={clsx(MONO, 'overflow-auto p-3 pr-24 whitespace-pre text-text select-text')}>{ddl}</pre>
        </div>
    );
}
