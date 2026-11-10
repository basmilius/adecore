const LABEL_LENGTH = 32;

export const statementLabel = (sql: string): string => {
    const line = sql.replace(/\s+/g, ' ').trim();

    return line.length > LABEL_LENGTH ? `${line.slice(0, LABEL_LENGTH - 1).trimEnd()}…` : line;
};
