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
    if (dialect.engine === 'sqlite') {
        return (
            <div ref={ref} className={clsx('flex flex-col gap-4 p-3', className)}>
                <label className="flex items-start gap-3">
                    <Switch
                        label={t('designer.options.withoutRowid')}
                        checked={options.withoutRowid}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange(patchOptions(draft, { withoutRowid: checked }))}
                    />
                    <span className="flex flex-col">
                        <span className="text-sm text-text">{t('designer.options.withoutRowid')}</span>
                        <span className="text-xs text-text-muted">{t('designer.options.withoutRowidHint')}</span>
                    </span>
                </label>
                <label className="flex items-start gap-3">
                    <Switch
                        label={t('designer.options.strict')}
                        checked={options.strict}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange(patchOptions(draft, { strict: checked }))}
                    />
                    <span className="flex flex-col">
                        <span className="text-sm text-text">{t('designer.options.strict')}</span>
                        <span className="text-xs text-text-muted">{t('designer.options.strictHint')}</span>
                    </span>
                </label>
            </div>
        );
    }
    return (
        <div ref={ref} className={clsx('flex max-w-xl flex-col gap-4 p-3', className)}>
            <datalist id={`${id}-engines`}>
                {MYSQL_ENGINES.map((engine) => (
                    <option key={engine} value={engine} />
                ))}
            </datalist>
            <datalist id={`${id}-charsets`}>
                {MYSQL_CHARSETS.map((charset) => (
                    <option key={charset} value={charset} />
                ))}
            </datalist>
            <datalist id={`${id}-collations`}>
                {collationSuggestionsOf(options.charset).map((collation) => (
                    <option key={collation} value={collation} />
                ))}
            </datalist>
            <Field label={t('designer.options.engine')} hint={t('designer.options.serverDefault')}>
                <Input
                    mono
                    list={`${id}-engines`}
                    spellCheck={false}
                    value={options.engine}
                    disabled={disabled}
                    onChange={(event) => onChange(patchOptions(draft, { engine: event.target.value }))}
                />
            </Field>
            <Field label={t('designer.options.charset')} hint={t('designer.options.serverDefault')}>
                <Input
                    mono
                    list={`${id}-charsets`}
                    spellCheck={false}
                    value={options.charset}
                    disabled={disabled}
                    onChange={(event) => onChange(patchOptions(draft, { charset: event.target.value }))}
                />
            </Field>
            <Field label={t('designer.options.collation')} hint={t('designer.options.serverDefault')}>
                <Input
                    mono
                    list={`${id}-collations`}
                    spellCheck={false}
                    value={options.collation}
                    disabled={disabled}
                    onChange={(event) => onChange(patchOptions(draft, { collation: event.target.value }))}
                />
            </Field>
            <Field label={t('designer.options.comment')}>
                <TextArea
                    rows={3}
                    value={options.comment}
                    disabled={disabled}
                    onChange={(event) => onChange(patchOptions(draft, { comment: event.target.value }))}
                />
            </Field>
        </div>
    );
}
