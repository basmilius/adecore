import { sameDefinition } from './column.ts';
import type { Dialect } from './dialect.ts';
import type { ColumnDraft, ForeignKeyDraft, IndexDraft, TableDraft } from './draft.ts';
import type { TableOptions } from './parse.ts';

export interface KeptColumn {
    readonly original: ColumnDraft;
    readonly column: ColumnDraft;
    readonly renamed: boolean;
    readonly redefined: boolean;
    /* It sits elsewhere among the columns that stay, which only a position clause can say. */
    readonly moved: boolean;
    /* The column before it in the draft, or `null` when it is the first. */
    readonly after: string | null;
}

export interface AddedColumn {
    readonly column: ColumnDraft;
    /* Whether a column that stays comes after it, so that it cannot simply go to the end. */
    readonly placed: boolean;
    readonly after: string | null;
}

export interface RenamedIndex {
    readonly from: IndexDraft;
    readonly to: IndexDraft;
}

export interface TableDiff {
    readonly renamed: boolean;
    readonly droppedColumns: readonly ColumnDraft[];
    readonly keptColumns: readonly KeptColumn[];
    readonly addedColumns: readonly AddedColumn[];
    readonly primaryKeyChanged: boolean;
    /* As the original named them: an index that is gone and one that has to be made again. */
    readonly droppedIndexes: readonly IndexDraft[];
    readonly addedIndexes: readonly IndexDraft[];
    readonly renamedIndexes: readonly RenamedIndex[];
    readonly droppedForeignKeys: readonly ForeignKeyDraft[];
    readonly addedForeignKeys: readonly ForeignKeyDraft[];
    readonly optionsChanged: boolean;
}

const sameList = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((name, at) => name === right[at]);

/* The positions of a longest run that already is in order: those columns can stay where they are. */
const longestRun = (positions: readonly number[]): ReadonlySet<number> => {
    const length: number[] = [];
    const previous: number[] = [];
    let best = -1;
    for (let i = 0; i < positions.length; i++) {
        length[i] = 1;
        previous[i] = -1;
        for (let before = 0; before < i; before++) {
            if (positions[before]! < positions[i]! && length[before]! + 1 > length[i]!) {
                length[i] = length[before]! + 1;
                previous[i] = before;
            }
        }
        if (best < 0 || length[i]! > length[best]!) {
            best = i;
        }
    }
    const run = new Set<number>();
    for (let at = best; at >= 0; at = previous[at]!) {
        run.add(at);
    }
    return run;
};

const OPTION_FIELDS: readonly (keyof TableOptions)[] = ['engine', 'charset', 'collation', 'comment', 'withoutRowid', 'strict'];

const matches = (original: { readonly name: string; readonly key: string }, draft: { readonly originalName: string | null; readonly key: string }): boolean =>
    draft.originalName !== null && (original.name === '' ? draft.key === original.key : draft.originalName === original.name);

type Project = (names: readonly string[]) => string[];

const columnChanges = (dialect: Dialect, original: TableDraft, draft: TableDraft) => {
    const survivors = draft.columns.filter((column) => column.originalName !== null);
    const positions = survivors.map((column) => original.columns.findIndex((candidate) => candidate.name === column.originalName));
    const staying = longestRun(positions);
    let survivor = 0;
    const keptColumns: KeptColumn[] = [];
    const addedColumns: AddedColumn[] = [];
    draft.columns.forEach((column, at) => {
        const after = at === 0 ? null : draft.columns[at - 1]!.name;
        if (column.originalName === null) {
            addedColumns.push({ column, placed: draft.columns.slice(at + 1).some((later) => later.originalName !== null), after });
            return;
        }
        const rank = survivor++;
        const before = original.columns.find((candidate) => candidate.name === column.originalName);
        if (before === undefined) {
            return;
        }
        keptColumns.push({
            original: before,
            column,
            renamed: before.name !== column.name,
            redefined: !sameDefinition(dialect, before, column),
            moved: !staying.has(rank),
            after
        });
    });

    const droppedColumns = original.columns.filter((column) => !survivors.some((kept) => kept.originalName === column.name));
    return { droppedColumns, keptColumns, addedColumns };
};

const indexChanges = (original: TableDraft, draft: TableDraft, project: Project) => {
    const droppedIndexes: IndexDraft[] = [];
    const addedIndexes = draft.indexes.filter((index) => index.originalName === null);
    const renamedIndexes: RenamedIndex[] = [];
    for (const before of original.indexes) {
        const after = draft.indexes.find((index) => matches(before, index));
        if (after === undefined) {
            droppedIndexes.push(before);
        } else if (!sameList(project(before.columns), after.columns) || before.unique !== after.unique) {
            droppedIndexes.push(before);
            addedIndexes.push(after);
        } else if (before.name !== after.name) {
            renamedIndexes.push({ from: before, to: after });
        }
    }
    return { droppedIndexes, addedIndexes, renamedIndexes };
};

const sameForeignKey = (before: ForeignKeyDraft, after: ForeignKeyDraft, project: Project): boolean =>
    before.name === after.name &&
    sameList(project(before.columns), after.columns) &&
    before.referencedSchema === after.referencedSchema &&
    before.referencedTable === after.referencedTable &&
    sameList(before.referencedColumns, after.referencedColumns) &&
    before.onUpdate === after.onUpdate &&
    before.onDelete === after.onDelete;

const foreignKeyChanges = (original: TableDraft, draft: TableDraft, project: Project) => {
    const droppedForeignKeys: ForeignKeyDraft[] = [];
    const addedForeignKeys = draft.foreignKeys.filter((key) => key.originalName === null);
    for (const before of original.foreignKeys) {
        const after = draft.foreignKeys.find((key) => matches(before, key));
        if (after === undefined || !sameForeignKey(before, after, project)) {
            droppedForeignKeys.push(before);
            if (after !== undefined) {
                addedForeignKeys.push(after);
            }
        }
    }
    return { droppedForeignKeys, addedForeignKeys };
};

/* What a draft changes in the table it came from, told apart by the names items kept. */
export const diffOf = (dialect: Dialect, original: TableDraft, draft: TableDraft): TableDiff => {
    const renames = new Map(draft.columns.filter((column) => column.originalName !== null).map((column) => [column.originalName!, column.name]));
    const project: Project = (names) => names.map((name) => renames.get(name) ?? name);

    return {
        renamed: original.name !== draft.name,
        ...columnChanges(dialect, original, draft),
        primaryKeyChanged: !sameList(project(original.primaryKey), draft.primaryKey),
        ...indexChanges(original, draft, project),
        ...foreignKeyChanges(original, draft, project),
        optionsChanged: OPTION_FIELDS.some((field) => original.options[field] !== draft.options[field])
    };
};

/* Whether applying the draft removes a column, and with it the data in it. */
export const dropsColumns = (original: TableDraft, draft: TableDraft): boolean =>
    original.columns.some((column) => !draft.columns.some((kept) => kept.originalName === column.name));
