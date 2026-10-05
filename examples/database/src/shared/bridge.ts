import type { DatabaseFiles } from '@adecore/database';
import type { DatabaseRequest, DatabaseResponse } from '@adecore/database/protocol';

export const CHANNELS = {
    request: 'database:request',
    browse: 'database:browse',
    demoPath: 'database:demo-path',
    saveFile: 'database:save-file',
    openFile: 'database:open-file'
} as const;

export type BrowsePurpose = 'database' | 'identity';

/* What the preload hands the page as `window.database`. */
export interface DatabaseBridge {
    request(request: DatabaseRequest): Promise<DatabaseResponse>;
    /* The path a person picked in the system file dialog for a database file or an SSH key, or null when they cancelled. */
    browse(purpose: BrowsePurpose): Promise<string | null>;
    demoPath(): Promise<string>;
    /* The file dialogs of the views, for export and import. */
    saveFile: DatabaseFiles['save'];
    openFile: DatabaseFiles['open'];
}
