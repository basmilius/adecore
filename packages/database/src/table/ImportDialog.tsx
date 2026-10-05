import type { Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, FormError, Select, Spinner, Switch } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { ColumnInfo } from '../protocol/index.ts';
import { hasMapping } from './import-mapping.ts';

/* What a file's first lines look like, as the client samples them. */
export interface ImportSample {
    readonly columns: readonly string[];
    readonly rows: readonly (readonly string[])[];
}

/* How many of the sampled rows the preview shows. */
const PREVIEW_ROWS = 8;
const SKIP = '-1';

export interface ImportFormProps {
    /* The file's path, which the person confirms the import of. */
    path: string;
    /* The columns of the table a file column can go to. */
    tableColumns: readonly ColumnInfo[];
    /* `null` while a new sample is read. */
    sample: ImportSample | null;
    header: boolean;
    /* The table column each file column goes to, by name; `null` skips the file column. */
    mapping: readonly (string | null)[];
    busy: boolean;
    error: string | null;
    onHeaderChange(header: boolean): void;
    onMappingChange(fileColumn: number, tableColumn: string | null): void;
    onImport(): void;
    onCancel(): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The body of the import dialog: how the file's columns map onto the table's, and a look at the rows. */
export function ImportForm({
    path,
    tableColumns,
    sample,
    header,
    mapping,
    busy,
    error,
    onHeaderChange,
    onMappingChange,
    onImport,
    onCancel,
    className,
    ref
}: ImportFormProps) {
    const { t } = useTranslation('database');
    const items = [{ value: SKIP, label: t('table.import.skip') }, ...tableColumns.map((column, index) => ({ value: String(index), label: column.name }))];
    const valueOf = (name: string | null): string => {
        const index = name === null ? -1 : tableColumns.findIndex((column) => column.name === name);
        return index < 0 ? SKIP : String(index);
    };
    const canImport = sample !== null && hasMapping(mapping) && !busy;

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col gap-4', className)}>
            <p className="truncate font-mono text-code text-text-muted">{path}</p>
            <div className="flex items-center gap-3 text-sm text-text">
                <Switch checked={header} label={t('table.import.header')} disabled={busy} onCheckedChange={onHeaderChange} />
                <span>{t('table.import.header')}</span>
                {sample === null && <Spinner size={12} label={t('table.import.sampling')} />}
            </div>
            {sample !== null && (
                <>
                    <div className="grid min-h-0 grid-cols-2 items-center gap-x-3 gap-y-1.5 overflow-auto">
                        <span className="text-xs text-text-faint">{t('table.import.fileColumn')}</span>
                        <span className="text-xs text-text-faint">{t('table.import.tableColumn')}</span>
                        {sample.columns.map((name, index) => (
                            <MappingRow
                                key={index}
                                name={name}
                                value={valueOf(mapping[index] ?? null)}
                                items={items}
                                disabled={busy}
                                label={t('table.import.mapTo', { column: name })}
                                onChange={(value) => onMappingChange(index, value === SKIP ? null : (tableColumns[Number(value)]?.name ?? null))}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-text-faint">
                            {t('table.import.preview', { count: formatNumber(Math.min(sample.rows.length, PREVIEW_ROWS)) })}
                        </span>
                        <div className="max-h-48 overflow-auto rounded-lg border border-border">
                            <table className="w-full border-collapse text-left font-mono text-code">
                                <thead className="sticky top-0 bg-surface-raised">
                                    <tr>
                                        {sample.columns.map((name, index) => (
                                            <th key={index} className="max-w-48 truncate border-b border-border px-2 py-1 font-medium text-text-muted">
                                                {name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sample.rows.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                                        <tr key={rowIndex} className="border-b border-border-soft last:border-b-0">
                                            {sample.columns.map((_, index) => (
                                                <td key={index} className="max-w-48 truncate px-2 py-1 whitespace-nowrap text-text">
                                                    {row[index] ?? ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            {error !== null && <FormError>{error}</FormError>}
            <Dialog.Footer className="mt-0">
                <Button disabled={busy} onClick={onCancel}>
                    {t('table.import.cancel')}
                </Button>
                <Button variant="primary" disabled={!canImport} onClick={onImport}>
                    {busy && <Spinner size={12} />}
                    {t('table.import.confirm')}
                </Button>
            </Dialog.Footer>
        </div>
    );
}

interface MappingRowProps {
    name: string;
    value: string;
    items: { value: string; label: string }[];
    disabled: boolean;
    label: string;
    onChange(value: string): void;
}

function MappingRow({ name, value, items, disabled, label, onChange }: MappingRowProps) {
    return (
        <>
            <span className="truncate font-mono text-code text-text">{name}</span>
            <Select size="sm" className="w-full" label={label} value={value} items={items} disabled={disabled} onValueChange={onChange} />
        </>
    );
}

export interface ImportDialogProps extends ImportFormProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}

/* The import of a file into the table: pick how the columns map, look at the rows, confirm. */
export function ImportDialog({ open, onOpenChange, ...form }: ImportDialogProps) {
    const { t } = useTranslation('database');
    return (
        <Dialog.Root open={open} onOpenChange={(next) => !form.busy && onOpenChange(next)}>
            <Dialog.Popup className="flex max-h-[calc(100vh-96px)] w-[720px] max-w-[calc(100vw-48px)] flex-col p-5">
                <Dialog.Title>{t('table.import.title')}</Dialog.Title>
                <Dialog.Description className="mt-1 mb-4">{t('table.import.description')}</Dialog.Description>
                <ImportForm {...form} />
            </Dialog.Popup>
        </Dialog.Root>
    );
}
