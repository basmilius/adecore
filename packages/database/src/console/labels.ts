const LABEL_LENGTH = 32;

/* The tab of a statement: its SQL on one line, cut where it gets long. */
export const statementLabel = (sql: string): string => {
    const line = sql.replace(/\s+/g, ' ').trim();
    return line.length > LABEL_LENGTH ? `${line.slice(0, LABEL_LENGTH - 1).trimEnd()}…` : line;
};
