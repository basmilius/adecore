import type { EditorPosition, EditorRange } from '@adecore/editor';
import type { Keymap } from '@adecore/editor/keymap';
import type { WorkerRequestPort } from '@adecore/editor/worker-client';
import type { ServerMessage } from '@adecore/lsp';
import type { i18n } from 'i18next';
import type { ClipboardHost } from './clipboard-history.ts';
import type { NavigationHost } from './navigation-history.ts';
import type { PanelsHost } from './panel-size.ts';
import type { ProblemsHost } from './project-problems.ts';
import type { TemplatesHost } from './templates.ts';

export interface DiskText {
    text: string;
    mtime: number;
}

/* A file that changed without an editor of this project holding it: its new text waits as an unsaved draft. */
export interface StagedFile {
    readonly path: string;
    readonly disk: DiskText;
    readonly text: string;
}

export interface ProjectFiles {
    /* The text of a file that is no open document, as a draft holds it or the machine has it; null when it is not a text file. */
    read(path: string): Promise<DiskText | null>;
    /* Puts the new texts in the files' drafts and tells the person. Nothing is written to disk. */
    stage(files: readonly StagedFile[]): void;
    /* Writes the new texts through the machine; the reason of the first file that could not be saved, or null. */
    save(files: readonly StagedFile[]): Promise<string | null>;
    /* Moves a file or folder on the machine, with what is open on it, and tells the servers it moved; the reason it could not, or null. Without `exists` an edit cannot tell whether the target is there, so refuse a target that is. With `overwrite` the target is there and is replaced, which needs `supportsOverwrite`; what is open on the replaced target is the host's to close or reload. */
    rename(from: string, to: string, options?: { readonly overwrite: boolean }): Promise<string | null>;
    /* Makes a file with its text, through the machine, and tells the servers it was made; the reason it could not, or null. Without it no edit creates a file. Without `exists`, refuse a file that is there. With `overwrite` the file is there and its content becomes `text`, which needs `supportsOverwrite`; an editor still open on it is set to `text` by the edit itself. */
    create?(path: string, text: string, options?: { readonly overwrite: boolean }): Promise<string | null>;
    /* Deletes a file, or a folder with what is in it when `recursive`, and tells the servers it is gone; the reason it could not, or null. Without it no edit deletes anything. */
    delete?(path: string, options: { readonly recursive: boolean }): Promise<string | null>;
    /* Whether `create` and `rename` take `overwrite`. Without it an edit that asks to overwrite a file is refused, since the file is there. */
    readonly supportsOverwrite?: boolean;
    /* Whether a draft or an open editor at the path, or under it for a folder, holds text that is not saved. A delete that would lose it is refused. */
    isUnsaved?(path: string): boolean;
    /* Whether anything is at the path, a file of any kind or a folder. Without it, an edit cannot tell whether something that is no text file exists. It may move or delete it and leave the outcome to the machine, and `ignoreIfNotExists` cannot be honored. */
    exists?(path: string): Promise<boolean>;
    /* Whether the path is a folder. Without it, deleting anything that is no text file needs `recursive`. */
    isFolder?(path: string): Promise<boolean>;
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
    /* What the name belongs to, in words (`function`, `class`, `type parameter`), when the outline of the file lists it. */
    kind?: string;
    context: string;
    uses: readonly string[];
}

export interface SnippetVariableContext {
    readonly uri: string;
    readonly languageId: string;
    readonly position: EditorPosition;
    readonly selection: EditorRange;
    readonly selectedText: string;
    readonly currentLine: string;
    readonly currentWord: string;
    readonly cursorIndex: number;
    readonly cursorCount: number;
    readonly folder?: string;
    readonly path?: string;
}

/* What the editors of a project ask of the app that hosts them, in the part each feature reads. */
export interface SnippetsHost {
    readonly snippetTransformWorker?: () => WorkerRequestPort;
    /* Synchronous overrides; undefined delegates to built-ins or an editable unknown-variable placeholder. */
    resolveSnippetVariable?(name: string, context: SnippetVariableContext): string | undefined;
}

export interface MessagesHost {
    notify?(notification: EditorNotification): void;
    /* A message of a server for a person, or a line for its log; without it the messages are not shown. */
    onServerMessage?(message: ServerMessage): void;
}

export interface RenameHost {
    suggestNames?(request: RenameSuggestionsRequest, signal: AbortSignal): Promise<readonly string[]>;
}

export interface LanguageHost extends SnippetsHost, MessagesHost, RenameHost, NavigationHost, PanelsHost, ProblemsHost, TemplatesHost, ClipboardHost {
    /* The instance the app hands `UIProvider`, which the features read their words from too; the default instance without one. */
    readonly i18n?: i18n;
    readonly folder?: string;
    readonly files?: ProjectFiles;
    readonly apple?: boolean;
    readonly keymap?: Keymap;
}
