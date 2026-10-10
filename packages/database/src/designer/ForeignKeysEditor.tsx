import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, Field, Icon, IconButton, Input, Select, Spinner, type SelectItem } from '@adecore/ui';
import { FOREIGN_KEY_ACTIONS } from '../ddl/index.ts';
import type { EditorProps } from './editor-props.ts';
import { NamePicker } from './NamePicker.tsx';
import { addForeignKey, patchForeignKey, removeForeignKey, setReferencedTable, toggleForeignKeyColumn } from './edit.ts';

export interface ForeignKeysEditorProps extends EditorProps {
    schema: string;
    /* The tables a key can point at. */
    tables: readonly string[];
    /* The columns of a table, or `null` while they load. */
    referenceColumns(table: string): readonly string[] | null;
}

/* The engine's own behavior, which a key has without a clause. */
const DEFAULT_ACTION = 'default';

/* The foreign keys of the table. Each points at a table of the same schema, picked from the list, and at columns of that table. */
export function ForeignKeysEditor({ draft, schema, tables, referenceColumns, disabled, onChange, className, ref }: ForeignKeysEditorProps) {
    const { t } = useTranslation('database');
    const columns = draft.columns.map((column) => column.name);
    const actions = [
        { value: DEFAULT_ACTION, label: t('designer.foreignKeys.engineDefault') },
        ...FOREIGN_KEY_ACTIONS.map((action) => ({ value: action, label: action }))
    ];
    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col', className)}>
            <div>
                {draft.foreignKeys.length === 0 && <EmptyState>{t('designer.foreignKeys.empty')}</EmptyState>}
                {draft.foreignKeys.map((foreignKey) => {
                    const referenced = foreignKey.referencedTable === '' ? [] : referenceColumns(foreignKey.referencedTable);
                    const choices =
                        tables.includes(foreignKey.referencedTable) || foreignKey.referencedTable === '' ? tables : [...tables, foreignKey.referencedTable];
                    return (
                        <div key={foreignKey.key} className="flex flex-col gap-3 border-b border-border-soft px-3 py-3">
                            <div className="flex items-end gap-3">
                                <Field label={t('designer.foreignKeys.name')} className="w-56">
                                    <Input
                                        size="sm"
                                        spellCheck={false}
                                        value={foreignKey.name}
                                        disabled={disabled}
                                        onChange={(event) => onChange(patchForeignKey(draft, foreignKey.key, { name: event.target.value }))}
                                    />
                                </Field>
                                <Field label={t('designer.foreignKeys.referencedTable')} group className="w-56">
                                    <Select
                                        size="sm"
                                        className="w-full"
                                        label={t('designer.foreignKeys.referencedTable')}
                                        placeholder={t('designer.foreignKeys.pickTable')}
                                        value={foreignKey.referencedTable === '' ? null : foreignKey.referencedTable}
                                        disabled={disabled}
                                        items={choices.map((table) => ({ value: table, label: table }))}
                                        onValueChange={(table) => onChange(setReferencedTable(draft, foreignKey.key, schema, table))}
                                    />
                                </Field>
                                <ActionField
                                    label={t('designer.foreignKeys.onUpdate')}
                                    value={foreignKey.onUpdate}
                                    items={actions}
                                    disabled={disabled}
                                    onValueChange={(action) => onChange(patchForeignKey(draft, foreignKey.key, { onUpdate: action }))}
                                />
                                <ActionField
                                    label={t('designer.foreignKeys.onDelete')}
                                    value={foreignKey.onDelete}
                                    items={actions}
                                    disabled={disabled}
                                    onValueChange={(action) => onChange(patchForeignKey(draft, foreignKey.key, { onDelete: action }))}
                                />
                                <IconButton
                                    icon={Trash2}
                                    size="xs"
                                    className="mb-1"
                                    label={t('designer.foreignKeys.remove')}
                                    disabled={disabled}
                                    onClick={() => onChange(removeForeignKey(draft, foreignKey.key))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('designer.foreignKeys.columns')} group>
                                    <NamePicker
                                        label={t('designer.foreignKeys.columns')}
                                        options={columns}
                                        value={foreignKey.columns}
                                        disabled={disabled}
                                        onToggle={(name) => onChange(toggleForeignKeyColumn(draft, foreignKey.key, 'columns', name))}
                                    />
                                </Field>
                                <Field label={t('designer.foreignKeys.referencedColumns')} group>
                                    {referenced === null ? (
                                        <Spinner size={14} label={t('designer.foreignKeys.loadingColumns')} />
                                    ) : (
                                        <NamePicker
                                            label={t('designer.foreignKeys.referencedColumns')}
                                            options={referenced}
                                            value={foreignKey.referencedColumns}
                                            disabled={disabled}
                                            onToggle={(name) => onChange(toggleForeignKeyColumn(draft, foreignKey.key, 'referencedColumns', name))}
                                        />
                                    )}
                                </Field>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="shrink-0 px-3 py-2">
                <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onChange(addForeignKey(draft, schema))}>
                    <Icon icon={Plus} size={12} />
                    {t('designer.foreignKeys.add')}
                </Button>
            </div>
        </div>
    );
}

/* What a key does on an update or a delete; `null` is the engine's default. */
function ActionField({
    label,
    value,
    items,
    disabled,
    onValueChange
}: {
    label: string;
    value: string | null;
    items: SelectItem<string>[];
    disabled: boolean;
    onValueChange(action: string | null): void;
}) {
    return (
        <Field label={label} group className="w-40">
            <Select
                size="sm"
                className="w-full"
                label={label}
                value={value ?? DEFAULT_ACTION}
                disabled={disabled}
                items={items}
                onValueChange={(action) => onValueChange(action === DEFAULT_ACTION ? null : action)}
            />
        </Field>
    );
}
