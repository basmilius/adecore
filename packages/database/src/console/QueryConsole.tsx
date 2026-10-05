import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import clsx from 'clsx';
import { Check, CircleAlert, History, Play, Square } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Icon, messageOf, PromptDialog, Spinner, Tabs, Tooltip } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { DatabaseRequestError, type Connection } from '../client/types.ts';
import { useDatabaseClient, useDatabaseFiles } from '../client-context.ts';
import type { FileFormat, RowsResult, SchemaInfo, StatementResult } from '../protocol/index.ts';
import { splitStatements, statementAt } from '../sql-split.ts';
import { DestructiveDialog } from './DestructiveDialog.tsx';
import { findDestructive, type DestructiveStatement } from './destructive.ts';
import type { HistoryEntry } from './history.ts';
import { HistoryPanel } from './HistoryPanel.tsx';
import { statementLabel } from './labels.ts';
import { isPageable, outcomeOf } from './outcome.ts';
import { SchemaPicker } from './SchemaPicker.tsx';
import { orderSchemas } from './schemas.ts';
import { RUN_ALL_SHORTCUT, RUN_SHORTCUT } from './shortcuts.ts';
import { SqlEditor, type RunScope } from './SqlEditor.tsx';
import { StatementResultView, type ResultPager } from './StatementResultView.tsx';
import { TransactionControls, type TransactionMode } from './TransactionControls.tsx';
import { useConsoleHistory } from './useConsoleHistory.ts';

export interface QueryConsoleProps {
    connection: Connection;
    /* The schema the statements run in. */
    schema?: string;
    /* The SQL, when the app keeps it (a tab that survives a reload). Without it the console keeps the text itself, starting from `defaultValue`. */
    value?: string;
    defaultValue?: string;
    onValueChange?(sql: string): void;
    /* Opens the history list beside the editor from the start. */
    defaultHistoryOpen?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

type Run =
    | { readonly status: 'idle' }
    | { readonly status: 'running' }
    | { readonly status: 'done'; readonly results: readonly StatementResult[] }
    | { readonly status: 'failed'; readonly message: string }
    | { readonly status: 'cancelled' };

/* What a run is about to execute, and how the toolbar names it afterwards. */
interface RunTarget {
    readonly sql: string;
    readonly ran: Ran;
}

type Ran = { readonly kind: 'statement'; readonly label: string } | { readonly kind: 'selection' } | { readonly kind: 'all'; readonly count: number };

interface PageState {
    readonly offset: number;
    readonly rows: RowsResult;
}

interface Notice {
    readonly tone: 'error' | 'neutral';
    readonly message: string;
}

/* Rows in the first page of a result, and in every page after it. */
const PAGE_SIZE = 500;

const ranText = (ran: Ran, t: TFunction<'database'>): string => {
    switch (ran.kind) {
        case 'statement':
            return t('console.ranStatement', { statement: ran.label });
        case 'selection':
            return t('console.ranSelection');
        case 'all':
            return t('console.ranAll', { count: ran.count });
    }
};

/* Type SQL, run it, and read what each statement did. Several statements give a tab each. */
export function QueryConsole({ connection, schema, value, defaultValue = '', onValueChange, defaultHistoryOpen = false, className, ref }: QueryConsoleProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const files = useDatabaseFiles();
    const session = useMemo(() => client.session(connection), [client, connection]);
    const engine = connection.config.engine;
    const history = useConsoleHistory(connection.id);
    const running = useRef<AbortController | null>(null);
    const generation = useRef(0);
    const editor = useRef<HTMLTextAreaElement>(null);
    const [own, setOwn] = useState(defaultValue);
    const [run, setRun] = useState<Run>({ status: 'idle' });
    const [ran, setRan] = useState<Ran | null>(null);
    const [tab, setTab] = useState(0);
    const [pages, setPages] = useState<Readonly<Record<number, PageState>>>({});
    const [paging, setPaging] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(defaultHistoryOpen);
    const [mode, setMode] = useState<TransactionMode>('auto');
    const [inTransaction, setInTransaction] = useState(false);
    const [settling, setSettling] = useState(false);
    const [endingManual, setEndingManual] = useState(false);
    const [confirming, setConfirming] = useState<{ readonly target: RunTarget; readonly statements: readonly DestructiveStatement[] } | null>(null);
    const [schemas, setSchemas] = useState<readonly SchemaInfo[]>([]);
    const [seededSchema, setSeededSchema] = useState(schema);
    const [pickedSchema, setPickedSchema] = useState<string | undefined>(undefined);
    const [exporting, setExporting] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const sql = value ?? own;
    const blank = sql.trim() === '';
    const busy = run.status === 'running' || settling;
    const activeSchema = pickedSchema ?? schema;

    if (seededSchema !== schema) {
        setSeededSchema(schema);
        setPickedSchema(undefined);
    }

    useEffect(() => () => running.current?.abort(), []);

    useEffect(() => {
        if (engine !== 'mysql') {
            return undefined;
        }
        const controller = new AbortController();
        session
            .schemas({ signal: controller.signal })
            .then((list) => setSchemas(orderSchemas(list)))
            .catch(() => undefined);
        return () => controller.abort();
    }, [engine, session]);

    const changeSql = (next: string): void => {
        if (value === undefined) {
            setOwn(next);
        }
        onValueChange?.(next);
    };

    const targetOf = (scope: RunScope): RunTarget | null => {
        if (scope === 'all') {
            const statements = splitStatements(sql, engine);
            const [only] = statements;
            if (only === undefined) {
                return null;
            }
            return { sql, ran: statements.length > 1 ? { kind: 'all', count: statements.length } : { kind: 'statement', label: statementLabel(only.text) } };
        }
        const start = editor.current?.selectionStart ?? 0;
        const end = editor.current?.selectionEnd ?? 0;
        const selected = sql.slice(start, end);
        if (splitStatements(selected, engine).length > 0) {
            return { sql: selected, ran: { kind: 'selection' } };
        }
        const statement = statementAt(sql, start, engine);
        return statement === null ? null : { sql: statement.text, ran: { kind: 'statement', label: statementLabel(statement.text) } };
    };

    const requestRun = (target: RunTarget | null): void => {
        if (target === null || busy) {
            return;
        }
        const statements = findDestructive(target.sql, engine);
        if (statements.length > 0) {
            setConfirming({ target, statements });
            return;
        }
        void execute(target);
    };

    const execute = async (target: RunTarget): Promise<void> => {
        const controller = new AbortController();
        const mine = ++generation.current;
        running.current = controller;
        setRun({ status: 'running' });
        setRan(target.ran);
        setNotice(null);
        const record = (outcome: Pick<HistoryEntry, 'ok' | 'rows'>): void =>
            history.record({ sql: target.sql, at: Date.now(), connection: connection.name, ...outcome });
        try {
            if (mode === 'manual' && !inTransaction) {
                setInTransaction(await session.transaction('begin', { signal: controller.signal }));
            }
            const executed = await session.execute(target.sql, { schema: activeSchema, limit: PAGE_SIZE, signal: controller.signal });
            if (controller.signal.aborted) {
                setRun({ status: 'cancelled' });
                return;
            }
            setInTransaction(executed.inTransaction);
            setTab(0);
            setPages({});
            setRun({ status: 'done', results: executed.results });
            record(outcomeOf(executed.results));
        } catch (error) {
            if (controller.signal.aborted || (error instanceof DatabaseRequestError && error.code === 'cancelled')) {
                setRun({ status: 'cancelled' });
            } else {
                setRun({ status: 'failed', message: messageOf(error) });
                record({ ok: false, rows: null });
            }
        } finally {
            if (generation.current === mine) {
                running.current = null;
            }
        }
    };

    const pickHistory = (entry: HistoryEntry, runIt: boolean): void => {
        changeSql(entry.sql);
        if (runIt) {
            requestRun({ sql: entry.sql, ran: { kind: 'statement', label: statementLabel(entry.sql) } });
        }
    };

    const settle = async (action: 'commit' | 'rollback'): Promise<boolean> => {
        setSettling(true);
        try {
            setInTransaction(await session.transaction(action));
            return true;
        } catch (error) {
            setNotice({ tone: 'error', message: messageOf(error) });
            return false;
        } finally {
            setSettling(false);
        }
    };

    const settleAndGoAuto = async (action: 'commit' | 'rollback'): Promise<void> => {
        if (await settle(action)) {
            setMode('auto');
        }
        setEndingManual(false);
    };

    const changeMode = (next: TransactionMode): void => {
        if (next === 'auto' && inTransaction) {
            setEndingManual(true);
        } else {
            setMode(next);
        }
    };

    const loadPage = async (index: number, result: StatementResult, offset: number): Promise<void> => {
        const mine = generation.current;
        setPaging(true);
        setNotice(null);
        try {
            const rows = await session.page(result.sql, { schema: activeSchema, offset, limit: PAGE_SIZE });
            if (generation.current === mine) {
                setPages((current) => ({ ...current, [index]: { offset, rows } }));
            }
        } catch (error) {
            setNotice({ tone: 'error', message: messageOf(error) });
        } finally {
            setPaging(false);
        }
    };

    const exportResult = async (result: StatementResult, format: FileFormat): Promise<void> => {
        if (files === undefined) {
            return;
        }
        setExporting(true);
        try {
            const path = await files.save({ suggestedName: `result.${format}`, format });
            if (path !== null) {
                const exported = await session.export({ source: { kind: 'query', sql: result.sql, schema: activeSchema }, format, path });
                setNotice({ tone: 'neutral', message: t('console.exported', { count: exported.rows, formatted: formatNumber(exported.rows) }) });
            }
        } catch (error) {
            setNotice({ tone: 'error', message: messageOf(error) });
        } finally {
            setExporting(false);
        }
    };

    const results = run.status === 'done' ? run.results : [];
    const index = Math.min(tab, results.length - 1);
    const base = results[index];
    const page = pages[index];
    const shown: StatementResult | undefined = base?.kind === 'rows' && page !== undefined ? { kind: 'rows', sql: base.sql, ...page.rows } : base;
    const offset = page?.offset ?? 0;
    const pager: ResultPager | undefined =
        base?.kind === 'rows' && shown?.kind === 'rows' && isPageable(base.sql, engine) && (shown.hasMore || offset > 0)
            ? {
                  page: offset / PAGE_SIZE + 1,
                  loading: paging,
                  onPrevious: () => void loadPage(index, base, Math.max(0, offset - PAGE_SIZE)),
                  onNext: () => void loadPage(index, base, offset + PAGE_SIZE)
              }
            : undefined;
    const exportBase = files !== undefined && base?.kind === 'rows' ? base : undefined;

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col bg-surface text-text', className)}>
            <div className="flex shrink-0 border-b border-border">
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                    <SqlEditor
                        ref={editor}
                        value={sql}
                        onValueChange={changeSql}
                        onRun={(scope) => requestRun(targetOf(scope))}
                        label={t('console.editor')}
                        placeholder={t('console.placeholder')}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {run.status === 'running' ? (
                            <>
                                <Button size="sm" onClick={() => running.current?.abort()}>
                                    <Icon icon={Square} size={12} />
                                    {t('console.cancel')}
                                </Button>
                                <Spinner size={14} label={t('console.running')} />
                            </>
                        ) : (
                            <>
                                <Tooltip label={t('console.run')} kbd={RUN_SHORTCUT}>
                                    <Button variant="primary" size="sm" disabled={blank || busy} onClick={() => requestRun(targetOf('selection-or-statement'))}>
                                        <Icon icon={Play} size={12} />
                                        {t('console.run')}
                                    </Button>
                                </Tooltip>
                                <Tooltip label={t('console.runAll')} kbd={RUN_ALL_SHORTCUT}>
                                    <Button variant="secondary" size="sm" disabled={blank || busy} onClick={() => requestRun(targetOf('all'))}>
                                        {t('console.runAll')}
                                    </Button>
                                </Tooltip>
                            </>
                        )}
                        <TransactionControls
                            mode={mode}
                            onModeChange={changeMode}
                            open={inTransaction}
                            busy={busy}
                            onCommit={() => void settle('commit')}
                            onRollback={() => void settle('rollback')}
                        />
                        {ran !== null && run.status !== 'idle' && <span className="min-w-0 truncate text-xs text-text-muted">{ranText(ran, t)}</span>}
                        <div className="ml-auto flex items-center gap-2">
                            {schemas.length > 0 && (
                                <SchemaPicker schemas={schemas} value={activeSchema ?? null} disabled={busy} onValueChange={setPickedSchema} />
                            )}
                            <Button
                                size="sm"
                                aria-pressed={historyOpen}
                                className="aria-pressed:bg-surface-active aria-pressed:text-text"
                                onClick={() => setHistoryOpen(!historyOpen)}
                            >
                                <Icon icon={History} size={12} />
                                {t('console.history.title')}
                            </Button>
                        </div>
                    </div>
                </div>
                {historyOpen && <HistoryPanel entries={history.entries} onPick={pickHistory} onClear={history.clear} />}
            </div>
            {run.status === 'failed' && <Banner icon={CircleAlert} tone="error" message={run.message} className="shrink-0 pt-2" />}
            {run.status === 'cancelled' && <Banner icon={CircleAlert} tone="neutral" message={t('console.cancelled')} className="shrink-0 pt-2" />}
            {notice !== null && (
                <Banner icon={notice.tone === 'error' ? CircleAlert : Check} tone={notice.tone} message={notice.message} className="shrink-0 pt-2">
                    <Button size="xs" onClick={() => setNotice(null)}>
                        {t('console.dismiss')}
                    </Button>
                </Banner>
            )}
            {results.length > 1 && (
                <Tabs.Root value={tab} onValueChange={(next) => setTab(Number(next))}>
                    <Tabs.List className="shrink-0 px-3">
                        {results.map((result, position) => (
                            <Tabs.Tab key={position} value={position}>
                                {statementLabel(result.sql)}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.Root>
            )}
            {shown !== undefined && (
                <StatementResultView
                    key={`${index}:${offset}`}
                    result={shown}
                    offset={offset}
                    pager={pager}
                    onExport={exportBase === undefined ? undefined : (format) => void exportResult(exportBase, format)}
                    exporting={exporting}
                    engine={engine}
                    valuePanelOpen={panelOpen}
                    onValuePanelOpenChange={setPanelOpen}
                />
            )}
            <DestructiveDialog
                statements={confirming?.statements ?? []}
                onCancel={() => setConfirming(null)}
                onConfirm={() => {
                    const target = confirming?.target;
                    setConfirming(null);
                    if (target !== undefined) {
                        void execute(target);
                    }
                }}
            />
            <PromptDialog
                open={endingManual}
                title={t('console.transaction.endTitle')}
                description={t('console.transaction.endDescription')}
                confirmLabel={t('console.transaction.commit')}
                secondary={{ label: t('console.transaction.rollback'), onClick: () => void settleAndGoAuto('rollback') }}
                onConfirm={() => settleAndGoAuto('commit')}
                onOpenChange={() => setEndingManual(false)}
            />
        </div>
    );
}
