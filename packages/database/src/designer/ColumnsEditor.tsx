import { useId } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, EmptyState, Icon, IconButton, Input, Pill } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { typeSuggestionsOf } from '../ddl/index.ts';
import type { EditorProps } from './editor-props.ts';
import { addColumn, moveColumn, patchColumn, removeColumn, togglePrimaryKey } from './edit.ts';

const TH = 'sticky top-0 z-10 h-7 bg-surface px-2 text-left text-xs font-medium whitespace-nowrap text-text-faint';
const TD = 'border-t border-border-soft px-2 py-1 align-middle';

/* The columns of the table as rows to edit: name, type, null, default, key, comment and where each one sits. */
export function ColumnsEditor({ draft, dialect, disabled, onChange, className, ref }: EditorProps) {
    const { t } = useTranslation('database');
    const listId = useId();
    const mysql = dialect.engine === 'mysql';
    const defaultType = typeSuggestionsOf(dialect)[0]!;
    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col', className)}>
            {draft.columns.length === 0 ? (
                <EmptyState>{t('designer.columns.empty')}</EmptyState>
            ) : (
                <div>
                    <datalist id={listId}>
                        {typeSuggestionsOf(dialect).map((type) => (
                            <option key={type} value={type} />
                        ))}
                    </datalist>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th scope="col" className={TH}>
                                    <span className="sr-only">{t('designer.columns.order')}</span>
                                </th>
                                <th scope="col" className={TH}>
                                    {t('designer.columns.name')}
                                </th>
                                <th scope="col" className={TH}>
                                    {t('designer.columns.type')}
                                </th>
                                <th scope="col" className={clsx(TH, 'text-center')}>
                                    {t('designer.columns.notNull')}
                                </th>
                                <th scope="col" className={TH}>
                                    {t('designer.columns.default')}
                                </th>
                                {mysql && (
                                    <th scope="col" className={clsx(TH, 'text-center')}>
                                        {t('designer.columns.autoIncrement')}
                                    </th>
                                )}
                                <th scope="col" className={TH}>
                                    {t('designer.columns.primaryKey')}
                                </th>
                                {mysql && (
                                    <th scope="col" className={TH}>
                                        {t('designer.columns.comment')}
                                    </th>
                                )}
                                <th scope="col" className={TH}>
                                    <span className="sr-only">{t('designer.columns.remove')}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {draft.columns.map((column, at) => {
                                const keyAt = draft.primaryKey.indexOf(column.name);
                                const locked = disabled || column.generated;
                                const patch = (change: Parameters<typeof patchColumn>[2]): void => onChange(patchColumn(draft, column.key, change));
                                return (
                                    <tr key={column.key}>
                                        <td className={clsx(TD, 'whitespace-nowrap')}>
                                            <span className="flex">
                                                <IconButton
                                                    icon={ArrowUp}
                                                    size="xs"
                                                    label={t('designer.columns.moveUp')}
                                                    disabled={disabled || at === 0}
                                                    onClick={() => onChange(moveColumn(draft, column.key, -1))}
                                                />
                                                <IconButton
                                                    icon={ArrowDown}
                                                    size="xs"
                                                    label={t('designer.columns.moveDown')}
                                                    disabled={disabled || at === draft.columns.length - 1}
                                                    onClick={() => onChange(moveColumn(draft, column.key, 1))}
                                                />
                                            </span>
                                        </td>
                                        <td className={clsx(TD, 'min-w-40')}>
                                            <Input
                                                size="sm"
                                                className="w-full"
                                                aria-label={t('designer.columns.name')}
                                                spellCheck={false}
                                                value={column.name}
                                                disabled={locked}
                                                onChange={(event) => patch({ name: event.target.value })}
                                            />
                                        </td>
                                        <td className={clsx(TD, 'min-w-36')}>
                                            <Input
                                                size="sm"
                                                mono
                                                className="w-full"
                                                aria-label={t('designer.columns.type')}
                                                list={listId}
                                                spellCheck={false}
                                                value={column.type}
                                                disabled={locked}
                                                onChange={(event) => patch({ type: event.target.value })}
                                            />
                                        </td>
                                        <td className={TD}>
                                            <Checkbox
                                                className="mx-auto"
                                                label={t('designer.columns.notNullFor', { name: column.name })}
                                                checked={!column.nullable}
                                                disabled={locked}
                                                onCheckedChange={(checked) => patch({ nullable: !checked })}
                                            />
                                        </td>
                                        <td className={clsx(TD, 'min-w-36')}>
                                            {column.generated ? (
                                                <Pill mono>{column.generatedClause ?? t('designer.columns.generated')}</Pill>
                                            ) : (
                                                <Input
                                                    size="sm"
                                                    mono
                                                    className="w-full"
                                                    aria-label={t('designer.columns.default')}
                                                    placeholder={t('designer.columns.noDefault')}
                                                    spellCheck={false}
                                                    value={column.defaultValue ?? ''}
                                                    disabled={disabled}
                                                    onChange={(event) => patch({ defaultValue: event.target.value === '' ? null : event.target.value })}
                                                />
                                            )}
                                        </td>
                                        {mysql && (
                                            <td className={TD}>
                                                <Checkbox
                                                    className="mx-auto"
                                                    label={t('designer.columns.autoIncrementFor', { name: column.name })}
                                                    checked={column.autoIncrement}
                                                    disabled={locked}
                                                    onCheckedChange={(checked) => patch({ autoIncrement: checked })}
                                                />
                                            </td>
                                        )}
                                        <td className={clsx(TD, 'whitespace-nowrap')}>
                                            <span className="flex items-center gap-1">
                                                <IconButton
                                                    icon={KeyRound}
                                                    size="xs"
                                                    label={keyAt < 0 ? t('designer.columns.addToKey') : t('designer.columns.removeFromKey')}
                                                    aria-pressed={keyAt >= 0}
                                                    disabled={locked}
                                                    onClick={() => onChange(togglePrimaryKey(draft, column.key))}
                                                />
                                                {keyAt >= 0 && draft.primaryKey.length > 1 && (
                                                    <span className="text-xs text-text-muted">{formatNumber(keyAt + 1)}</span>
                                                )}
                                            </span>
                                        </td>
                                        {mysql && (
                                            <td className={clsx(TD, 'min-w-40')}>
                                                <Input
                                                    size="sm"
                                                    className="w-full"
                                                    aria-label={t('designer.columns.comment')}
                                                    value={column.comment}
                                                    disabled={locked}
                                                    onChange={(event) => patch({ comment: event.target.value })}
                                                />
                                            </td>
                                        )}
                                        <td className={TD}>
                                            <IconButton
                                                icon={Trash2}
                                                size="xs"
                                                label={t('designer.columns.remove')}
                                                disabled={disabled}
                                                onClick={() => onChange(removeColumn(draft, column.key))}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="shrink-0 border-t border-border-soft px-3 py-2">
                <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onChange(addColumn(draft, defaultType))}>
                    <Icon icon={Plus} size={12} />
                    {t('designer.columns.add')}
                </Button>
            </div>
        </div>
    );
}
