import type { Ref } from 'react';
import type { Dialect, TableDraft } from '../ddl/index.ts';

/* What every tab of the designer is given: the draft it edits, and a way to hand back the next one. */
export interface EditorProps {
    draft: TableDraft;
    dialect: Dialect;
    /* Nothing can be edited, such as on a connection that is read only. */
    disabled: boolean;
    onChange(draft: TableDraft): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}
