import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { Check, CircleAlert, History, Play, Square, X } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Banner, Button, ColumnResizeHandle, Icon, IconButton, messageOf, PromptDialog, Spinner, Tabs, Tooltip, useColumnResize } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { DatabaseRequestError, type Connection } from '../client/types.ts';
import { useDatabaseClient, useDatabaseFiles, useDatabaseStorage } from '../client-context.ts';
import type { FileFormat, RowsResult, SchemaInfo, StatementResult } from '../protocol/index.ts';
import { splitStatements, statementAt } from '../sql-split.ts';
import { DestructiveDialog } from './DestructiveDialog.tsx';
import type { QueryConsoleEditorHandle, QueryConsoleEditorProps, QueryConsoleRunScope } from './editor-slot.ts';
import { findDestructive, type DestructiveStatement } from './destructive.ts';
import type { HistoryEntry } from './history.ts';
import { HistoryPanel } from './HistoryPanel.tsx';
import { statementLabel } from './labels.ts';
import { isPageable, outcomeOf } from './outcome.ts';
import { SchemaPicker } from './SchemaPicker.tsx';
import { orderSchemas } from './schemas.ts';
import { RUN_ALL_SHORTCUT, RUN_SHORTCUT } from './shortcuts.ts';
import { SqlEditor } from './SqlEditor.tsx';
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
    /* Puts the caret in the editor when the console mounts, for one a person just opened. */
    autoFocus?: boolean;
    /* Draws the app's own editor in place of the console's text area. It owns its keys and runs through `run`. */
    renderEditor?(editor: QueryConsoleEditorProps): ReactNode;
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

/* Where the height of the results is kept, in pixels, for every console. */
export const RESULTS_HEIGHT_KEY = 'database:console-results';

/* The results and the editor never shrink below these; the results start at half the console. */
const MIN_RESULTS_HEIGHT = 96;
const MIN_EDITOR_HEIGHT = 120;

const parseHeight = (raw: string | null | undefined): number | null => {
    try {
        const value: unknown = JSON.parse(raw ?? 'null');
        return typeof value === 'number' && Number.isFinite(value) && value >= MIN_RESULTS_HEIGHT ? Math.round(value) : null;
    } catch {
        return null;
    }
};

const ranText = (ran: Ran, t: TFunction<'database'>): string => {
    switch (ran.kind) {
        case 'statement':
            return t('console.ranStatement', { statement: ran.label });
        case 'selection':
            return t('console.ranSelection');
        case 'all':
            return t('console.ranAll', { count: ran.count, formatted: formatNumber(ran.count) });
    }
};

/* The app's editor as an element of its own, so it gets its props the way `SqlEditor` does and not during the console's render. */
function AppEditor({ render, ...editor }: QueryConsoleEditorProps & { render(editor: QueryConsoleEditorProps): ReactNode }) {
    return render(editor);
}

/* Type SQL, run it, and read what each statement did. Several statements give a tab each. */
export function QueryConsole({
    connection,
    schema,
    value,
    defaultValue = '',
    onValueChange,
    defaultHistoryOpen = false,
    autoFocus = false,
    renderEditor,
    className,
    ref
}: QueryConsoleProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const files = useDatabaseFiles();
    const storage = useDatabaseStorage();
    // A channel of its own, so a transaction a person starts here stays out of the table views and the designer.
    const channel = `console:${useId()}`;
    const session = useMemo(() => client.session(connection, channel), [client, connection, channel]);
    const engine = connection.config.engine;
    useEffect(
        () => () => {
            void session.close();
        },
        [session]
    );
    const history = useConsoleHistory(connection.id);
    const running = useRef<AbortController | null>(null);
    const generation = useRef(0);
    const editorHandle = useRef<QueryConsoleEditorHandle>(null);
    const resultsPane = useRef<HTMLElement>(null);
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
    /* Closed until the first run, so the editor has the whole height before anything ran. */
    const [resultsOpen, setResultsOpen] = useState(false);
    const [resultsHeight, setResultsHeight] = useState(() => parseHeight(storage?.get(RESULTS_HEIGHT_KEY)));
    const { startResize } = useColumnResize(resultsPane, {
        size: resultsHeight ?? MIN_RESULTS_HEIGHT,
        min: MIN_RESULTS_HEIGHT,
        from: 'bottom',
        max: () => (resultsPane.current?.parentElement?.clientHeight ?? 0) - MIN_EDITOR_HEIGHT,
        onSize: setResultsHeight
    });
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
        if (resultsHeight !== null) {
            storage?.set(RESULTS_HEIGHT_KEY, JSON.stringify(resultsHeight));
        }
    }, [storage, resultsHeight]);

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

    const targetOf = (scope: QueryConsoleRunScope): RunTarget | null => {
        const selection = editorHandle.current?.selection();
        if (scope === 'all' || selection === undefined) {
            const statements = splitStatements(sql, engine);
            const [only] = statements;
            if (only === undefined) {
                return null;
            }
            return { sql, ran: statements.length > 1 ? { kind: 'all', count: statements.length } : { kind: 'statement', label: statementLabel(only.text) } };
        }
        const { start, end } = selection;
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
        setResultsOpen(true);
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

    const editorProps: QueryConsoleEditorProps = {
        ref: editorHandle,
        value: sql,
        onValueChange: changeSql,
        run: (scope) => requestRun(targetOf(scope)),
        busy,
        label: t('console.editor'),
        placeholder: t('console.placeholder'),
        autoFocus
    };

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col bg-surface text-text', className)}>
            <div className="flex min-h-0 flex-1">
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* The app's editor runs edge to edge, the way it draws a file; the text area keeps the inset of a field. */}
                    <div className={clsx('flex min-h-0 flex-1 flex-col', renderEditor === undefined && 'px-3 pt-3')}>
                        {renderEditor === undefined ? <SqlEditor {...editorProps} /> : <AppEditor render={renderEditor} {...editorProps} />}
                    </div>
                    <div
                        className={clsx(
                            'flex shrink-0 flex-wrap items-center gap-2 px-3 pb-3',
                            renderEditor === undefined ? 'pt-2' : 'border-t border-border pt-3'
                        )}
                    >
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
            {notice !== null && (
                <Banner icon={notice.tone === 'error' ? CircleAlert : Check} tone={notice.tone} message={notice.message} className="shrink-0 pb-2">
                    <Button size="xs" onClick={() => setNotice(null)}>
                        {t('console.dismiss')}
                    </Button>
                </Banner>
            )}
            {resultsOpen && (
                <section
                    ref={resultsPane}
                    aria-label={t('console.results')}
                    className="relative flex min-h-24 shrink-0 flex-col border-t border-border"
                    style={{ height: resultsHeight ?? '50%', maxHeight: `calc(100% - ${MIN_EDITOR_HEIGHT}px)` }}
                >
                    <ColumnResizeHandle from="bottom" onPointerDown={startResize} />
                    <Tabs.Root value={index} onValueChange={(next) => setTab(Number(next))}>
                        <Tabs.List
                            aria-label={t('console.results')}
                            className="shrink-0 pr-1.5 pl-3"
                            end={<IconButton icon={X} size="sm" label={t('console.closeResults')} onClick={() => setResultsOpen(false)} />}
                        >
                            {results.map((result, position) => (
                                <Tabs.Tab key={position} value={position}>
                                    {statementLabel(result.sql)}
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>
                    </Tabs.Root>
                    {run.status === 'failed' && <Banner icon={CircleAlert} tone="error" message={run.message} className="shrink-0 pt-2" />}
                    {run.status === 'cancelled' && <Banner icon={CircleAlert} tone="neutral" message={t('console.cancelled')} className="shrink-0 pt-2" />}
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
                </section>
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
