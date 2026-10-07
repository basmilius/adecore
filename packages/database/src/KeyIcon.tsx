import clsx from 'clsx';
import { KeyRound } from 'lucide-react';
import { Icon } from '@adecore/ui';
import type { ColumnKeys } from './column-keys.ts';

/*
 * The key of a column, yellow on a primary key and blue on a foreign key, the same in the tree and the
 * grid. A column that is both shows the primary key, since that is what names its row; the tooltip says both.
 */
export function KeyIcon({ primaryKey, foreignKey, size }: ColumnKeys & { size: 12 | 16 }) {
    if (!primaryKey && !foreignKey) {
        return null;
    }
    return <Icon icon={KeyRound} size={size} className={clsx('shrink-0', primaryKey ? 'text-(--file-icon-yellow)' : 'text-(--file-icon-blue)')} />;
}
