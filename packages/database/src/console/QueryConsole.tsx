import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, Play, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Icon, messageOf, shortcut, Spinner, Tabs, Tooltip } from '@adecore/ui';
import { DatabaseRequestError, type Connection } from '../client/types.ts';
import { useDatabaseClient } from '../client-context.ts';
import type { StatementResult } from '../protocol/index.ts';
import { statementLabel } from './labels.ts';
import { SqlEditor } from './SqlEditor.tsx';
import { StatementResultView } from './StatementResultView.tsx';

export interface QueryConsoleProps {
    connection: Connection;
    /* The schema the statements run in. */
    schema?: string;
    /* The SQL, when the app keeps it (a tab that survives a reload). Without it the console keeps the text itself, starting from `defaultValue`. */
    value?: string;
    defaultValue?: string;
    onValueChange?(sql: string): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

type Run =
    | { readonly status: 'idle' }
    | { readonly status: 'running' }
    | { readonly status: 'done'; readonly results: readonly StatementResult[] }
    | { readonly status: 'failed'; readonly message: string }
    | { readonly status: 'cancelled' };

const RUN_SHORTCUT = shortcut('Mod+Enter');

/* Type SQL, run it, and read what each statement did. Several statements give a tab each. */
export function QueryConsole({ connection, schema, value, defaultValue = '', onValueChange, className, ref }: QueryConsoleProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const session = useMemo(() => client.session(connection), [client, connection]);
    const running = useRef<AbortController | null>(null);
    const [own, setOwn] = useState(defaultValue);
    const [run, setRun] = useState<Run>({ status: 'idle' });
    const [tab, setTab] = useState(0);
    const sql = value ?? own;
    const blank = sql.trim() === '';

    useEffect(() => () => running.current?.abort(), []);

    const changeSql = (next: string): void => {
        if (value === undefined) {
            setOwn(next);
        }
        onValueChange?.(next);
    };

    const execute = async (): Promise<void> => {
        if (blank || run.status === 'running') {
            return;
        }
        const controller = new AbortController();
        running.current = controller;
        setRun({ status: 'running' });
        try {
            const results = await session.execute(sql, { schema, signal: controller.signal });
            if (!controller.signal.aborted) {
                setTab(0);
                setRun({ status: 'done', results });
            }
        } catch (error) {
            if (controller.signal.aborted || (error instanceof DatabaseRequestError && error.code === 'cancelled')) {
                setRun({ status: 'cancelled' });
            } else {
                setRun({ status: 'failed', message: messageOf(error) });
            }
        }
    };

    const results = run.status === 'done' ? run.results : [];
    const shown = results[Math.min(tab, results.length - 1)];

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col bg-surface text-text', className)}>
            <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
                <SqlEditor
                    value={sql}
                    onValueChange={changeSql}
                    onRun={() => void execute()}
                    label={t('console.editor')}
                    placeholder={t('console.placeholder')}
                />
                <div className="flex items-center gap-2">
                    {run.status === 'running' ? (
                        <>
                            <Button size="sm" onClick={() => running.current?.abort()}>
                                <Icon icon={Square} size={12} />
                                {t('console.cancel')}
                            </Button>
                            <Spinner size={14} label={t('console.running')} />
                        </>
                    ) : (
                        <Tooltip label={t('console.run')} kbd={RUN_SHORTCUT}>
                            <Button variant="primary" size="sm" disabled={blank} onClick={() => void execute()}>
                                <Icon icon={Play} size={12} />
                                {t('console.run')}
                            </Button>
                        </Tooltip>
                    )}
                </div>
            </div>
            {run.status === 'failed' && <Banner icon={CircleAlert} tone="error" message={run.message} className="shrink-0 pt-2" />}
            {run.status === 'cancelled' && <Banner icon={CircleAlert} tone="neutral" message={t('console.cancelled')} className="shrink-0 pt-2" />}
            {results.length > 1 && (
                <Tabs.Root value={tab} onValueChange={(next) => setTab(Number(next))}>
                    <Tabs.List className="shrink-0 px-3">
                        {results.map((result, index) => (
                            <Tabs.Tab key={index} value={index}>
                                {statementLabel(result.sql)}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.Root>
            )}
            {shown !== undefined && <StatementResultView key={tab} result={shown} />}
        </div>
    );
}
