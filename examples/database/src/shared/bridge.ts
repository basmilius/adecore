import type { DatabaseRequest, DatabaseResponse } from '@adecore/database/protocol';

export const CHANNELS = {
    request: 'database:request',
    browse: 'database:browse',
    demoPath: 'database:demo-path'
} as const;

/* What the preload hands the page as `window.database`. */
export interface DatabaseBridge {
    request(request: DatabaseRequest): Promise<DatabaseResponse>;
    /* The path a person picked in the system file dialog, or null when they cancelled. */
    browse(): Promise<string | null>;
    demoPath(): Promise<string>;
}
