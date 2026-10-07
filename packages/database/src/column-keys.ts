export interface ColumnKeys {
    readonly primaryKey: boolean;
    readonly foreignKey: boolean;
}

/* The words that name what a key column is, for its tooltip. */
export const keyLabelOf = ({ primaryKey, foreignKey }: ColumnKeys): 'explorer.primaryAndForeignKey' | 'explorer.primaryKey' | 'explorer.foreignKey' =>
    primaryKey && foreignKey ? 'explorer.primaryAndForeignKey' : primaryKey ? 'explorer.primaryKey' : 'explorer.foreignKey';
