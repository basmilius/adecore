/* A table of values as it is shown; hidden, it stays for a screen reader without any of these. */
const TABLE_CLASSES = {
    box: 'max-h-80 w-full overflow-auto rounded-md border border-border-soft',
    table: 'w-full border-collapse text-xs tabular-nums',
    head: 'sticky top-0 bg-surface-hover',
    column: 'h-8 px-2 text-right font-medium whitespace-nowrap text-text-muted',
    row: 'border-t border-border-soft',
    rowHeading: 'h-8 px-2 text-left font-normal whitespace-nowrap text-text-muted',
    cell: 'h-8 px-2 text-right whitespace-nowrap text-text'
};

export const tableClasses = (shown: boolean): Partial<typeof TABLE_CLASSES> & { box: string } => (shown ? TABLE_CLASSES : { box: 'sr-only' });
