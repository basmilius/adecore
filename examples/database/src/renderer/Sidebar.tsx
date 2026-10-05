import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';
import { ConnectionManager, DatabaseExplorer, type Connection, type TableRef } from '@adecore/database';
import { Button, ColumnResizeHandle, Dialog, IconButton, useColumnResize } from '@adecore/ui';

export interface SidebarProps {
    connections: readonly Connection[];
    onConnectionsChange(next: readonly Connection[]): void;
    onBrowse(): Promise<string | null>;
    selected: TableRef | null;
    onSelectedChange(ref: TableRef | null): void;
    onOpenTable(ref: TableRef): void;
}

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;

/* The explorer under a header, on a column the pointer can resize. */
export function Sidebar({ connections, onConnectionsChange, onBrowse, selected, onSelectedChange, onOpenTable }: SidebarProps) {
    const { t } = useTranslation();
    const column = useRef<HTMLElement>(null);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [managing, setManaging] = useState(false);
    const { startResize } = useColumnResize(column, {
        size: width,
        min: MIN_WIDTH,
        from: 'left',
        max: () => window.innerWidth / 2,
        onSize: setWidth
    });

    return (
        <aside ref={column} className="relative flex shrink-0 flex-col border-r border-border bg-surface" style={{ width }}>
            <header className="flex h-11 shrink-0 items-center justify-between border-b border-border pr-2 pl-3">
                <h1 className="text-sm font-semibold text-text">{t('sidebar.title')}</h1>
                <IconButton icon={Settings2} size="sm" label={t('sidebar.manage')} onClick={() => setManaging(true)} />
            </header>
            <DatabaseExplorer
                connections={connections}
                value={selected}
                onValueChange={onSelectedChange}
                onOpen={onOpenTable}
                className="min-h-0 flex-1"
            />
            <ColumnResizeHandle from="left" onPointerDown={startResize} />
            <Dialog.Root open={managing} onOpenChange={setManaging}>
                <Dialog.Popup className="flex h-[560px] w-[900px] flex-col overflow-hidden">
                    <div className="border-b border-border px-4 py-3">
                        <Dialog.Title>{t('connections.title')}</Dialog.Title>
                    </div>
                    <ConnectionManager value={connections} onValueChange={onConnectionsChange} onBrowse={onBrowse} className="min-h-0 flex-1" />
                    <Dialog.Footer>
                        <Dialog.Close render={<Button variant="secondary" />}>{t('connections.close')}</Dialog.Close>
                    </Dialog.Footer>
                </Dialog.Popup>
            </Dialog.Root>
        </aside>
    );
}
