import { useId } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Field, Input, Switch, TextArea } from '@adecore/ui';
import { MYSQL_CHARSETS, MYSQL_ENGINES, collationSuggestionsOf } from '../ddl/index.ts';
import type { EditorProps } from './editor-props.ts';
import { patchOptions } from './edit.ts';

/* The options of a table, which differ per engine: a storage engine and character set on MySQL, rowid and strict typing on SQLite. */
export function OptionsEditor({ draft, dialect, disabled, onChange, className, ref }: EditorProps) {
    const { t } = useTranslation('database');
    const id = useId();
    const { options } = draft;
    const patch = (change: Parameters<typeof patchOptions>[1]): void => onChange(patchOptions(draft, change));
    if (dialect.engine === 'sqlite') {
        return (
            <div ref={ref} className={clsx('flex flex-col gap-4 p-3', className)}>
                <OptionSwitch
                    label={t('designer.options.withoutRowid')}
                    hint={t('designer.options.withoutRowidHint')}
                    checked={options.withoutRowid}
                    disabled={disabled}
                    onCheckedChange={(withoutRowid) => patch({ withoutRowid })}
                />
                <OptionSwitch
                    label={t('designer.options.strict')}
                    hint={t('designer.options.strictHint')}
                    checked={options.strict}
                    disabled={disabled}
                    onCheckedChange={(strict) => patch({ strict })}
                />
            </div>
        );
    }
    return (
        <div ref={ref} className={clsx('flex max-w-xl flex-col gap-4 p-3', className)}>
            <SuggestedField
                label={t('designer.options.engine')}
                listId={`${id}-engines`}
                suggestions={MYSQL_ENGINES}
                value={options.engine}
                disabled={disabled}
                onValueChange={(engine) => patch({ engine })}
            />
            <SuggestedField
                label={t('designer.options.charset')}
                listId={`${id}-charsets`}
                suggestions={MYSQL_CHARSETS}
                value={options.charset}
                disabled={disabled}
                onValueChange={(charset) => patch({ charset })}
            />
            <SuggestedField
                label={t('designer.options.collation')}
                listId={`${id}-collations`}
                suggestions={collationSuggestionsOf(options.charset)}
                value={options.collation}
                disabled={disabled}
                onValueChange={(collation) => patch({ collation })}
            />
            <Field label={t('designer.options.comment')}>
                <TextArea rows={3} value={options.comment} disabled={disabled} onChange={(event) => patch({ comment: event.target.value })} />
            </Field>
        </div>
    );
}

function OptionSwitch({
    label,
    hint,
    checked,
    disabled,
    onCheckedChange
}: {
    label: string;
    hint: string;
    checked: boolean;
    disabled: boolean;
    onCheckedChange(checked: boolean): void;
}) {
    return (
        <label className="flex items-start gap-3">
            <Switch label={label} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
            <span className="flex flex-col">
                <span className="text-sm text-text">{label}</span>
                <span className="text-xs text-text-muted">{hint}</span>
            </span>
        </label>
    );
}

/* A free text field with a list of common values to pick from; empty leaves it to the server. */
function SuggestedField({
    label,
    listId,
    suggestions,
    value,
    disabled,
    onValueChange
}: {
    label: string;
    listId: string;
    suggestions: readonly string[];
    value: string;
    disabled: boolean;
    onValueChange(value: string): void;
}) {
    const { t } = useTranslation('database');
    return (
        <>
            <datalist id={listId}>
                {suggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                ))}
            </datalist>
            <Field label={label} hint={t('designer.options.serverDefault')}>
                <Input mono list={listId} spellCheck={false} value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)} />
            </Field>
        </>
    );
}
