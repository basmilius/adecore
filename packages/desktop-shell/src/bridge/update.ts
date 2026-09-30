/* Where updating stands, as the shell keeps it and the page draws it. */
export interface UpdateState {
    /* `unsupported` is a checkout, which has no feed; `current` means a check found nothing newer. */
    status: 'unsupported' | 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error';
    currentVersion: string;
    /* The version on the other side, once a check has seen one. */
    version?: string;
    percent?: number;
    error?: string | null;
}
