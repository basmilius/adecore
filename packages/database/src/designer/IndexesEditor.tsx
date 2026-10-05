import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, EmptyState, Icon, IconButton, Input } from '@adecore/ui';
import type { EditorProps } from './editor-props.ts';
import { NamePicker } from './NamePicker.tsx';
import { addIndex, patchIndex, removeIndex, toggleIndexColumn } from './edit.ts';

/* The indexes of the table other than its primary key, each over columns picked from the draft. */
export function IndexesEditor({ draft, disabled, onChange, className, ref }: EditorProps) {
    const { t } = useTranslation('database');
    const columns = draft.columns.map((column) => column.name);
    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col', className)}>
            <div>
                {draft.indexes.length === 0 && <EmptyState>{t('designer.indexes.empty')}</EmptyState>}
                {draft.indexes.map((index) => (
                    <div key={index.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-soft px-3 py-2">
                        <Input
                            size="sm"
                            className="w-56"
                            aria-label={t('designer.indexes.name')}
                            spellCheck={false}
                            value={index.name}
                            disabled={disabled}
                            onChange={(event) => onChange(patchIndex(draft, index.key, { name: event.target.value }))}
                        />
                        <label className="flex items-center gap-2 text-xs text-text-muted">
                            <Checkbox
                                label={t('designer.indexes.unique')}
                                checked={index.unique}
                                disabled={disabled}
                                onCheckedChange={(checked) => onChange(patchIndex(draft, index.key, { unique: checked }))}
                            />
                            {t('designer.indexes.unique')}
                        </label>
                        <NamePicker
                            className="min-w-0 grow"
                            label={t('designer.indexes.columns')}
                            options={columns}
                            value={index.columns}
                            disabled={disabled}
                            onToggle={(name) => onChange(toggleIndexColumn(draft, index.key, name))}
                        />
                        <IconButton
                            icon={Trash2}
                            size="xs"
                            label={t('designer.indexes.remove')}
                            disabled={disabled}
                            onClick={() => onChange(removeIndex(draft, index.key))}
                        />
                    </div>
                ))}
            </div>
            <div className="shrink-0 px-3 py-2">
                <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onChange(addIndex(draft))}>
                    <Icon icon={Plus} size={12} />
                    {t('designer.indexes.add')}
                </Button>
            </div>
        </div>
    );
}
