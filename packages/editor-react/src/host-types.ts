import type { i18n } from 'i18next';
import type { Keymap } from '@adecore/editor/keymap';
import type { ProjectFiles } from './workspace-edit.ts';
import type { Place } from './navigation-history.ts';

export interface DiskText {
    text: string;
    mtime: number;
}

export interface GitBlameCommit {
    hash: string;
    shortHash: string;
    author: string;
    email: string;
    at: number;
    summary: string;
}

export interface GitBlameResult {
    commits: GitBlameCommit[];
    lines: number[];
    omitted?: 'untracked' | 'too-large';
}

export interface EditorNotification {
    id: string;
    kind: 'success' | 'error';
    title: string;
}

export interface RenameSuggestionsRequest {
    uri: string;
    languageId: string;
    name: string;
    context: string;
    uses: readonly string[];
}

export interface LanguageHost {
    /* The instance the app hands `UIProvider`, which the features read their words from too; the default instance without one. */
    readonly i18n?: i18n;
    readonly folder?: string;
    readonly files?: ProjectFiles;
    readonly apple?: boolean;
    readonly keymap?: Keymap;
    openPlace?(place: Place): void;
    pathOfUri?(uri: string): string | null;
    serverNames?(uri: string): readonly string[];
    notify?(notification: EditorNotification): void;
    suggestNames?(request: RenameSuggestionsRequest, signal: AbortSignal): Promise<readonly string[]>;
}
