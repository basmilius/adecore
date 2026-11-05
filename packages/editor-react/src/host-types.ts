import type { EditorPosition, EditorRange } from '@adecore/editor';
import type { Keymap } from '@adecore/editor/keymap';
import type { WorkerRequestPort } from '@adecore/editor/worker-client';
import type { ServerMessage } from '@adecore/lsp';
import type { i18n } from 'i18next';
import type { ClipboardHistory } from './clipboard-history.ts';
import type { Place } from './navigation-history.ts';
import type { ProblemSource } from './project-problems.ts';
import type { LiveTemplateDraft, TemplateRegistry } from './templates.ts';

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

export interface LanguageHost {
    readonly snippetTransformWorker?: () => WorkerRequestPort;
    /* The instance the app hands `UIProvider`, which the features read their words from too; the default instance without one. */
    readonly i18n?: i18n;
    readonly folder?: string;
    readonly files?: ProjectFiles;
    readonly apple?: boolean;
    readonly keymap?: Keymap;
    /* What Paste from History lists. A new `ClipboardHistory` that lives as long as the project without one; pass one to choose its size or to keep its entries. */
    readonly clipboard?: ClipboardHistory;
    /* What templates the editors of the project know. A registry of the built-in ones that lives as long as the project without one. */
    readonly templates?: TemplateRegistry;
    /* Save as Live Template: the host opens its own form with this draft. Without it the command does nothing. */
    saveAsLiveTemplate?(draft: LiveTemplateDraft): void;
    /* The last row of the template lists, "Configure live templates…"; the row is left out without it. */
    openTemplateSettings?(): void;
    /* How many places Last Edit Location and Next Edit Location remember; 150 without one. */
    readonly editHistoryLimit?: number;
    /* The height in pixels of the list-and-preview area of the peek and the call hierarchy, so a person's drag outlives the panel; 180 without one. */
    readonly panelBodyHeight?: number;
    /* A person finished resizing a peek or call hierarchy panel; the height is already within what the editor allows. */
    onPanelResize?(height: number): void;
    /* Where `project.problems` reads its reports, such as a machine that also reports files no editor here holds; the service's diagnostics without one. */
    readonly problemSource?: ProblemSource;
    openPlace?(place: Place): void;
    /* Opens a web address outside the editor, from a link in the text or a server; a new browser window without it. */
    openExternal?(url: string): void;
    pathOfUri?(uri: string): string | null;
    serverNames?(uri: string): readonly string[];
    notify?(notification: EditorNotification): void;
    /* A message of a server for a person, or a line for its log; without it the messages are not shown. */
    onServerMessage?(message: ServerMessage): void;
    /* Synchronous overrides; undefined delegates to built-ins or an editable unknown-variable placeholder. */
    resolveSnippetVariable?(name: string, context: SnippetVariableContext): string | undefined;
    suggestNames?(request: RenameSuggestionsRequest, signal: AbortSignal): Promise<readonly string[]>;
}
