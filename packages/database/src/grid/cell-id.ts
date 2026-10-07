/* The id of a cell, which the grid's `aria-activedescendant` points at. */
export const cellIdOf = (gridId: string, row: number, column: number): string => `${gridId}-${row}-${column}`;
