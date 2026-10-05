import { useEffect, useRef, useState } from 'react';
import { messageOf } from '@adecore/ui';
import type { DatabaseFiles } from '../actions.ts';
import { DatabaseRequestError, type DatabaseClient, type DatabaseSession } from '../client/types.ts';
import type { FileFormat, TableStructure } from '../protocol/index.ts';
import type { ImportSample } from './ImportDialog.tsx';
import { formatOfPath, importableColumns, mapColumn, matchColumns, type ImportFormat } from './import-mapping.ts';

/* What the strip over the table says about an export or an import. */
export type TransferNotice =
    | { readonly kind: 'exporting'; readonly format: FileFormat }
    | { readonly kind: 'exported'; readonly rows: number }
    | { readonly kind: 'imported'; readonly rows: number }
    | { readonly kind: 'failed'; readonly message: string };

/* The import a person is setting up. */
export interface ImportDraft {
    readonly path: string;
    readonly format: ImportFormat;
    readonly header: boolean;
    /* `null` while a new sample is read. */
    readonly sample: ImportSample | null;
    readonly mapping: readonly (string | null)[];
    readonly busy: boolean;
    readonly error: string | null;
}

export interface TableTransferInput {
    readonly client: DatabaseClient;
    readonly session: DatabaseSession;
    /* Without the app's file dialogs there is no export and no import. */
    readonly files: DatabaseFiles | undefined;
    readonly schema: string;
    readonly table: string;
    readonly structure: TableStructure | null;
    /* The filters as applied, which an export respects. */
    readonly where: string;
    readonly orderBy: string;
    /* Rows were added; the table reloads. */
    readonly onImported: () => void;
}

export interface TableTransfer {
    readonly notice: TransferNotice | null;
    readonly importDraft: ImportDraft | null;
    exportAs(format: FileFormat): void;
    /* Stops the export that is running. */
    cancelExport(): void;
    dismiss(): void;
    chooseImportFile(): void;
    changeHeader(header: boolean): void;
    changeMapping(fileColumn: number, tableColumn: string | null): void;
    runImport(): void;
    closeImport(): void;
}

/* Export of the table as filtered, and import of a file into it, with the state both need between the dialogs and the strip. */
export function useTableTransfer({ client, session, files, schema, table, structure, where, orderBy, onImported }: TableTransferInput): TableTransfer {
    const [notice, setNotice] = useState<TransferNotice | null>(null);
    const [importDraft, setImportDraft] = useState<ImportDraft | null>(null);
    const exporting = useRef<AbortController | null>(null);
    const sampling = useRef<AbortController | null>(null);
    const tableColumns = structure === null ? [] : importableColumns(structure.columns).map((column) => column.name);

    useEffect(() => {
        if (notice?.kind !== 'exported' && notice?.kind !== 'imported') {
            return;
        }
        const timer = setTimeout(() => setNotice(null), 8000);
        return () => clearTimeout(timer);
    }, [notice]);

    useEffect(() => () => sampling.current?.abort(), []);

    const exportAs = (format: FileFormat): void => {
        if (files === undefined || exporting.current !== null) {
            return;
        }
        void (async () => {
            const path = await files.save({ suggestedName: `${table}.${format}`, format });
            if (path === null) {
                return;
            }
            const controller = new AbortController();
            exporting.current = controller;
            setNotice({ kind: 'exporting', format });
            try {
                const result = await session.export(
                    { source: { kind: 'table', schema, table, where: where || undefined, orderBy: orderBy || undefined }, format, path },
                    { signal: controller.signal }
                );
                setNotice({ kind: 'exported', rows: result.rows });
            } catch (error) {
                const cancelled = controller.signal.aborted || (error instanceof DatabaseRequestError && error.code === 'cancelled');
                setNotice(cancelled ? null : { kind: 'failed', message: messageOf(error) });
            } finally {
                exporting.current = null;
            }
        })();
    };

    const sample = async (path: string, format: ImportFormat, header: boolean): Promise<ImportSample> => {
        sampling.current?.abort();
        const controller = new AbortController();
        sampling.current = controller;
        return await client.sample(path, format, header, { signal: controller.signal });
    };

    const chooseImportFile = (): void => {
        if (files === undefined || structure === null) {
            return;
        }
        void (async () => {
            const path = await files.open({ formats: ['csv', 'tsv'] });
            if (path === null) {
                return;
            }
            const format = formatOfPath(path);
            try {
                const read = await sample(path, format, true);
                setImportDraft({ path, format, header: true, sample: read, mapping: matchColumns(read.columns, tableColumns, true), busy: false, error: null });
            } catch (error) {
                setNotice({ kind: 'failed', message: messageOf(error) });
            }
        })();
    };

    const changeHeader = (header: boolean): void => {
        if (importDraft === null) {
            return;
        }
        const { path, format } = importDraft;
        setImportDraft({ ...importDraft, header, sample: null, error: null });
        void (async () => {
            try {
                const read = await sample(path, format, header);
                setImportDraft((now) =>
                    now === null || now.path !== path ? now : { ...now, header, sample: read, mapping: matchColumns(read.columns, tableColumns, header) }
                );
            } catch (error) {
                if (!(error instanceof DatabaseRequestError && error.code === 'cancelled')) {
                    setImportDraft((now) => (now === null || now.path !== path ? now : { ...now, error: messageOf(error) }));
                }
            }
        })();
    };

    const changeMapping = (fileColumn: number, tableColumn: string | null): void => {
        setImportDraft((now) => (now === null ? now : { ...now, mapping: mapColumn(now.mapping, fileColumn, tableColumn) }));
    };

    const runImport = (): void => {
        if (importDraft === null || importDraft.busy || importDraft.sample === null) {
            return;
        }
        const { path, format, header, mapping } = importDraft;
        setImportDraft({ ...importDraft, busy: true, error: null });
        void (async () => {
            try {
                const rows = await session.import(schema, table, { path, format, header, columns: mapping });
                setImportDraft(null);
                setNotice({ kind: 'imported', rows });
                onImported();
            } catch (error) {
                setImportDraft((now) => (now === null ? now : { ...now, busy: false, error: messageOf(error) }));
            }
        })();
    };

    const closeImport = (): void => {
        sampling.current?.abort();
        setImportDraft(null);
    };

    return {
        notice,
        importDraft,
        exportAs,
        cancelExport: () => exporting.current?.abort(),
        dismiss: () => setNotice(null),
        chooseImportFile,
        changeHeader,
        changeMapping,
        runImport,
        closeImport
    };
}
