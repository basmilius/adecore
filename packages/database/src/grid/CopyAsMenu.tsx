import { Braces, Copy, Database, FileSpreadsheet, Table2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, Icon } from '@adecore/ui';
import type { CopyFormat } from './copy-formats.ts';

const ICONS: Record<CopyFormat, LucideIcon> = { tsv: Table2, csv: FileSpreadsheet, json: Braces, sql: Database };

export interface CopyAsMenuProps {
    disabled: boolean;
    formats: readonly CopyFormat[];
    onCopy(format: CopyFormat): void;
}

/* The "Copy as" submenu of the grid's context menu. */
export function CopyAsMenu({ disabled, formats, onCopy }: CopyAsMenuProps) {
    const { t } = useTranslation('database');
    return (
        <ContextMenu.SubmenuRoot>
            <ContextMenu.SubmenuTrigger disabled={disabled}>
                <Icon icon={Copy} size={14} />
                {t('grid.copyAs.label')}
            </ContextMenu.SubmenuTrigger>
            <ContextMenu.Popup>
                {formats.map((format) => (
                    <ContextMenu.Item key={format} onClick={() => onCopy(format)}>
                        <Icon icon={ICONS[format]} size={14} />
                        {t(`grid.copyAs.${format}`)}
                    </ContextMenu.Item>
                ))}
            </ContextMenu.Popup>
        </ContextMenu.SubmenuRoot>
    );
}
