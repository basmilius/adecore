import type { KeyboardEvent, Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, Lock, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, DisabledReason, Field, Icon, Input, PromptDialog, Tabs, isApplePlatform, matchesShortcut, shortcut } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { Dialect, TableDraft } from '../ddl/index.ts';
import { ColumnsEditor } from './ColumnsEditor.tsx';
import { ForeignKeysEditor } from './ForeignKeysEditor.tsx';
import { IndexesEditor } from './IndexesEditor.tsx';
import { OptionsEditor } from './OptionsEditor.tsx';
import { renameTable } from './edit.ts';
import { scriptOf, type Plan } from './plan.ts';
import { SqlPreview } from './SqlPreview.tsx';

export interface DesignerViewProps {
    dialect: Dialect;
    schema: string;
    draft: TableDraft;
    /* The table does not exist yet. */
    isNew: boolean;
    /* The draft differs from what was loaded. */
    changed: boolean;
    /* The tables a foreign key can point at. */
    tables: readonly string[];
    plan: Plan;
    /* Why nothing can be edited, or `null` when everything can. */
    readOnlyReason: string | null;
    /* What the last Apply answered with, kept until the next one. */
    failure: string | null;
    /* The confirmation of the statements is open. */
    confirming: boolean;
    /* The columns of a table a foreign key may point at, or `null` while they load. */
    referenceColumns(table: string): readonly string[] | null;
    onChange(draft: TableDraft): void;
    /* Opens the confirmation. */
    onRequestApply(): void;
    onConfirm(): Promise<void>;
    onCancelConfirm(): void;
    onRevert(): void;
    onDismissFailure(): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

const APPLY_SHORTCUT = /* @__PURE__ */ shortcut('Mod+S');

/* The designer with everything it needs handed in: the name, the four tabs, what Apply would run and the confirmation before it does. */
export function DesignerView({
    dialect,
    schema,
    draft,
    isNew,
    changed,
    tables,
    plan,
    readOnlyReason,
    failure,
    confirming,
    referenceColumns,
    onChange,
    onRequestApply,
    onConfirm,
    onCancelConfirm,
    onRevert,
    onDismissFailure,
    className,
    ref
}: DesignerViewProps) {
    const { t } = useTranslation('database');
    const disabled = readOnlyReason !== null;
    const applyReason =
        readOnlyReason ?? (plan.problems.length > 0 ? t('designer.fixProblems') : plan.statements.length === 0 ? t('designer.noChanges') : null);

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
        if (matchesShortcut(APPLY_SHORTCUT, event.nativeEvent, isApplePlatform())) {
            event.preventDefault();
            if (applyReason === null) {
                onRequestApply();
            }
        }
    }

    return (
        <div ref={ref} className={clsx('flex min-h-0 min-w-0 flex-col', className)} onKeyDown={handleKeyDown}>
            <div className="flex shrink-0 items-end gap-3 border-b border-border-soft px-3 py-2">
                <Field label={t('designer.tableName')} className="w-80">
                    <Input
                        mono
                        spellCheck={false}
                        placeholder={t('designer.tableNamePlaceholder')}
                        value={draft.name}
                        disabled={disabled}
                        onChange={(event) => onChange(renameTable(draft, event.target.value))}
                    />
                </Field>
                <div className="ml-auto flex items-center gap-2">
                    <Button variant="secondary" disabled={!changed} onClick={onRevert}>
                        <Icon icon={Undo2} size={12} />
                        {t('designer.revert')}
                    </Button>
                    <DisabledReason reason={applyReason}>
                        <span className="inline-flex">
                            <Button variant="primary" disabled={applyReason !== null} onClick={onRequestApply}>
                                {isNew ? t('designer.create') : t('designer.apply')}
                            </Button>
                        </span>
                    </DisabledReason>
                </div>
            </div>
            {readOnlyReason !== null && (
                <div className="shrink-0 px-3 pt-3">
                    <Banner icon={Lock} tone="neutral" className="w-full" message={readOnlyReason} />
                </div>
            )}
            {failure !== null && (
                <div className="shrink-0 px-3 pt-3">
                    <Banner icon={CircleAlert} tone="error" className="w-full" message={failure}>
                        <Button variant="secondary" size="sm" onClick={onDismissFailure}>
                            {t('designer.dismiss')}
                        </Button>
                    </Banner>
                </div>
            )}
            <Tabs.Root defaultValue="columns" className="flex min-h-0 grow flex-col">
                <Tabs.List className="shrink-0 px-3">
                    <Tabs.Tab value="columns">
                        {t('designer.tabs.columns')}
                        <Tabs.Count value={draft.columns.length} />
                    </Tabs.Tab>
                    <Tabs.Tab value="indexes">
                        {t('designer.tabs.indexes')}
                        <Tabs.Count value={draft.indexes.length} />
                    </Tabs.Tab>
                    <Tabs.Tab value="foreignKeys">
                        {t('designer.tabs.foreignKeys')}
                        <Tabs.Count value={draft.foreignKeys.length} />
                    </Tabs.Tab>
                    <Tabs.Tab value="options">{t('designer.tabs.options')}</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="columns" className="min-h-0 grow overflow-auto">
                    <ColumnsEditor draft={draft} dialect={dialect} disabled={disabled} onChange={onChange} />
                </Tabs.Panel>
                <Tabs.Panel value="indexes" className="min-h-0 grow overflow-auto">
                    <IndexesEditor draft={draft} dialect={dialect} disabled={disabled} onChange={onChange} />
                </Tabs.Panel>
                <Tabs.Panel value="foreignKeys" className="min-h-0 grow overflow-auto">
                    <ForeignKeysEditor
                        draft={draft}
                        dialect={dialect}
                        disabled={disabled}
                        schema={schema}
                        tables={tables}
                        referenceColumns={referenceColumns}
                        onChange={onChange}
                    />
                </Tabs.Panel>
                <Tabs.Panel value="options" className="min-h-0 grow overflow-auto">
                    <OptionsEditor draft={draft} dialect={dialect} disabled={disabled} onChange={onChange} />
                </Tabs.Panel>
            </Tabs.Root>
            <SqlPreview plan={plan} className="shrink-0" />
            <PromptDialog
                open={confirming}
                danger={plan.destructive}
                title={t('designer.confirm.title', { count: plan.statements.length, formatted: formatNumber(plan.statements.length) })}
                description={isNew ? t('designer.confirm.create', { table: draft.name }) : t('designer.confirm.alter', { table: draft.originalName })}
                confirmLabel={isNew ? t('designer.create') : t('designer.apply')}
                confirmBusyLabel={t('designer.applying')}
                onConfirm={onConfirm}
                onOpenChange={(open) => {
                    if (!open) {
                        onCancelConfirm();
                    }
                }}
            >
                {plan.destructive && <p className="mt-3 text-xs text-status-error">{t('designer.confirm.destructive')}</p>}
                <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-code whitespace-pre text-text select-text">
                    {scriptOf(plan.statements)}
                </pre>
            </PromptDialog>
        </div>
    );
}
