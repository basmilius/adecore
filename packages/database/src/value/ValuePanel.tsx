import { useMemo, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { Copy, MousePointerClick, WrapText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    Button,
    copyText,
    EmptyState,
    FormError,
    IconButton,
    isApplePlatform,
    KEY_SHORTCUTS,
    matchesShortcut,
    PanelHeader,
    Segmented,
    TextArea,
    Tooltip
} from '@adecore/ui';
import { formatBytes, formatNumber } from '@adecore/ui/format';
import type { GridColumn } from '../grid/types.ts';
import type { EditValue, Value } from '../protocol/index.ts';
import { editValueOf, sameDraft, sameSource, sourceOf, type Draft, type DraftProblem } from './draft.ts';
import { hexDumpLines, parseHex } from './hex.ts';
import { renderView, sizeOf, viewsOf, type Rendered, type ViewId } from './views.ts';

export interface ValuePanelProps {
    /* The column of the focused cell; `null` when no cell has focus, which draws an empty state. */
    column: GridColumn | null;
    /* The whole value of the cell. `undefined` while it loads, or when it cannot be had. */
    value: Value | undefined;
    loading: boolean;
    /* Whether this cell can be changed; a read only panel still shows, formats and copies. */
    editable: boolean;
    /* The panel's draft, applied as a pending edit like an edit in the grid. */
    onCommit?(value: EditValue): void;
    onClose(): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

const WRAPPING_VIEWS: ReadonlySet<ViewId> = new Set(['text', 'formatted', 'utf8']);

const READING = 'min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface p-2 font-mono text-code text-text';

/* The whole value of the focused cell beside the grid, to read and edit what a cell is too small for. */
export function ValuePanel({ column, value, loading, editable, onCommit, onClose, className, ref }: ValuePanelProps) {
    const { t } = useTranslation('database');
    const ready = column !== null && !loading && value !== undefined;

    return (
        <div ref={ref} className={clsx('flex h-full min-h-0 min-w-0 flex-col', className)}>
            <PanelHeader title={column === null ? t('value.title') : undefined}>
                {column !== null && (
                    <>
                        <span className="min-w-0 truncate text-sm font-medium text-text">{column.name}</span>
                        {column.type !== '' && <span className="min-w-0 shrink-0 truncate text-xs text-text-faint">{column.type}</span>}
                    </>
                )}
                <IconButton icon={X} size="sm" label={t('value.close')} className="ml-auto" onClick={onClose} />
            </PanelHeader>
            {ready ? (
                <ValueEditor column={column} value={value} editable={editable} onCommit={onCommit} />
            ) : (
                <div className="grid min-h-0 grow place-items-center">
                    <EmptyState icon={column === null ? MousePointerClick : undefined} busy={column !== null && loading}>
                        {column === null ? t('value.selectCell') : loading ? t('value.loading') : t('value.notLoaded')}
                    </EmptyState>
                </div>
            )}
        </div>
    );
}

interface ValueEditorProps {
    column: GridColumn;
    value: Value;
    editable: boolean;
    onCommit?(value: EditValue): void;
}

function ValueEditor({ column, value, editable, onCommit }: ValueEditorProps) {
    const { t } = useTranslation('database');
    const { name, type, kind } = column;
    const source = useMemo(() => sourceOf({ name, type, kind }, value), [name, type, kind, value]);
    const [seen, setSeen] = useState(source);
    const [draft, setDraft] = useState<Draft>(source.original);
    const [choice, setChoice] = useState<ViewId | null>(null);
    const [problem, setProblem] = useState<DraftProblem | null>(null);
    const [wrap, setWrap] = useState(true);

    // A new cell, or the same cell with a new value, starts over from that value.
    if (!sameSource(seen, source)) {
        setSeen(source);
        setDraft(source.original);
        setChoice(null);
        setProblem(null);
    }

    const views = viewsOf(source, draft);
    const view = choice !== null && views.includes(choice) ? choice : views[0]!;
    const dirty = !sameDraft(draft, source.original);
    const rendered = useMemo(() => (view === 'text' ? null : renderView(view, draft)), [view, draft]);
    const hex = source.binary && draft.mode === 'value' ? parseHex(draft.text) : null;
    const shownProblem: DraftProblem | null = problem ?? (hex !== null && !hex.ok ? { kind: 'hex', problem: hex.problem } : null);
    const size = sizeOf(source, draft);
    const placeholder = draft.mode === 'null' ? 'NULL' : draft.mode === 'default' ? 'DEFAULT' : undefined;

    const change = (next: Draft): void => {
        setDraft(next);
        setProblem(null);
    };

    const apply = (): void => {
        if (!editable || onCommit === undefined || !dirty) {
            return;
        }
        const conversion = editValueOf(draft, source);
        if (conversion.ok) {
            onCommit(conversion.value);
        } else {
            setProblem(conversion.problem);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (!event.nativeEvent.isComposing && matchesShortcut(KEY_SHORTCUTS.modEnter, event.nativeEvent, isApplePlatform())) {
            event.preventDefault();
            apply();
        }
    };

    const copy = (): void => {
        if (view === 'hex' && hex !== null && hex.ok) {
            copyText(hexDumpLines(hex.hex).join('\n'));
        } else if (rendered !== null && rendered.kind === 'text') {
            copyText(rendered.text);
        } else {
            copyText(draft.mode === 'value' ? draft.text : draft.mode === 'null' ? 'NULL' : 'DEFAULT');
        }
    };

    const editor = (extra?: string): ReactNode => (
        <TextArea
            mono
            aria-label={t(source.binary ? 'value.hexEditor' : 'value.editor', { column: column.name })}
            wrap={wrap || source.binary ? 'soft' : 'off'}
            spellCheck={false}
            readOnly={!editable}
            placeholder={placeholder}
            value={draft.mode === 'value' ? draft.text : ''}
            className={extra}
            onChange={(event) => change({ text: event.target.value, mode: 'value' })}
            onKeyDown={handleKeyDown}
        />
    );

    const problemText = (found: DraftProblem): string =>
        found.kind === 'json'
            ? t('value.invalidJson', { reason: found.reason })
            : t(found.problem === 'odd' ? 'value.invalidHexOdd' : 'value.invalidHexCharacters');

    const reading = (content: Rendered, wrapped: boolean): ReactNode => {
        if (content.kind === 'empty') {
            return <Faint>{placeholder}</Faint>;
        }
        if (content.kind === 'problem') {
            return <Faint>{problemText(content.problem)}</Faint>;
        }
        return (
            <>
                <pre className={clsx(READING, wrapped ? 'break-words whitespace-pre-wrap' : 'whitespace-pre')}>{content.text}</pre>
                {content.truncated && (
                    <p className="shrink-0 text-xs text-text-faint">
                        {t('value.dumpTruncated', { shown: formatNumber(content.truncated.shown), total: formatNumber(content.truncated.total) })}
                    </p>
                )}
            </>
        );
    };

    const body = (): ReactNode => {
        if (view === 'text') {
            return editor('min-h-0 flex-1');
        }
        if (view === 'hex' && editable) {
            return (
                <>
                    {draft.mode === 'value' && rendered !== null && reading(rendered, false)}
                    {editor(draft.mode === 'value' ? 'flex-none' : 'min-h-0 flex-1')}
                </>
            );
        }
        return rendered === null ? null : reading(rendered, wrap && WRAPPING_VIEWS.has(view));
    };

    return (
        <>
            <div className="flex h-10 shrink-0 items-center gap-2 px-2">
                {views.length > 1 && (
                    <Segmented<ViewId>
                        value={view}
                        onValueChange={(id) => setChoice(id)}
                        label={t('value.views')}
                        options={views.map((id) => ({ id, label: t(`value.view.${id}`) }))}
                    />
                )}
                <div className="ml-auto flex items-center gap-1">
                    {WRAPPING_VIEWS.has(view) && (
                        <IconButton icon={WrapText} size="sm" label={t('value.wrap')} aria-pressed={wrap} active={wrap} onClick={() => setWrap(!wrap)} />
                    )}
                    <IconButton icon={Copy} size="sm" label={t('value.copy')} onClick={copy} />
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">{body()}</div>
            {shownProblem !== null && <FormError className="shrink-0 px-3 pb-2 text-xs">{problemText(shownProblem)}</FormError>}
            {editable && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border p-2">
                    {column.nullable !== false && (
                        <Button size="xs" disabled={draft.mode === 'null'} onClick={() => change({ text: '', mode: 'null' })}>
                            {t('value.setNull')}
                        </Button>
                    )}
                    <Button size="xs" disabled={draft.mode === 'default'} onClick={() => change({ text: '', mode: 'default' })}>
                        {t('value.setDefault')}
                    </Button>
                    <span className="ml-auto flex items-center gap-1.5">
                        <Button size="xs" disabled={!dirty} onClick={() => change(source.original)}>
                            {t('value.revert')}
                        </Button>
                        <Tooltip label={t('value.applyHint')} kbd={KEY_SHORTCUTS.modEnter}>
                            <Button size="xs" variant="primary" disabled={!dirty || onCommit === undefined} onClick={apply}>
                                {t('value.apply')}
                            </Button>
                        </Tooltip>
                    </span>
                </div>
            )}
            <footer className="flex h-8 shrink-0 items-center border-t border-border px-3 text-xs text-text-muted tabular-nums">
                {size !== null &&
                    (size.unit === 'bytes' ? formatBytes(size.count) : t('value.characters', { count: size.count, formatted: formatNumber(size.count) }))}
            </footer>
        </>
    );
}

function Faint({ children }: { children?: ReactNode }) {
    return <div className="grid min-h-0 flex-1 place-items-center font-mono text-code text-text-faint">{children}</div>;
}
