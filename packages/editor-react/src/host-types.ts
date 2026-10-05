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
