import type { Editor, EditorKeyHandler, EditorPosition } from '@adecore/editor';
import type { Keymap } from '@adecore/editor/keymap';
import type { LanguageService, Location, TextDocumentSaveReason } from '@adecore/lsp';
import type { Place } from './navigation-history.ts';
import type { PopupStore } from './popups.ts';
import type { LanguageDocumentHandle, ProjectLanguage } from './project-language.ts';
import type { shortcutsOf } from './shortcut-keys.ts';

/*
 * What a feature knows of the editor it serves: the editor, its document, the project and the
 * features' shared pieces. A feature never reaches a sibling feature through it; what a feature needs
 * of another it is handed in its constructor, so the dependencies between features show in the one
 * place that builds them.
 */
export interface LanguageContext {
    readonly editor: Editor;
    readonly apple: boolean;
    readonly keymap: Keymap;
    readonly shortcuts: ReturnType<typeof shortcutsOf>;
    readonly project: ProjectLanguage;
    readonly document: LanguageDocumentHandle;
    readonly languageId: string;

    /* Whether a server serves this document; read it where a host meant "a language server is behind this editor". */
    readonly served: boolean;

    /* What the features of this editor have open over it: the hover card, the suggestions, the signature. */
    readonly popups: PopupStore;
    readonly uri: string;

    /* The service this document is asked through: the project's, or one that answers nothing when no server serves it. */
    readonly service: LanguageService;
    readonly isDisposed: boolean;

    /* Where the caret is, as a place the history can come back to. */
    readonly place: Place;

    /* Takes the caret to a place the servers named, in this file or in another one that opens beside it, and remembers where it was. */
    goTo(location: Location): void;

    /* Takes the caret to a position of this file and remembers where it was. */
    jump(position: EditorPosition): void;

    /* Goes to a place without touching the history, which is how Back and Forward move. */
    visit(place: Place): void;

    /* Runs `listener` once the document is open and again whenever the service says what it can ask for this document changed. */
    onProvidersChanged(listener: () => void): () => void;

    /* Lets `handler` see the editor's keys before every handler of a lower `priority`, the first to take a key winning. */
    onKey(handler: EditorKeyHandler, priority?: number): () => void;

    /* Lets the servers in before the host writes the file. */
    prepareSave(reason?: TextDocumentSaveReason): Promise<void>;

    /* Runs `dispose` when the editor lets go of its document. */
    onDispose(dispose: () => void): void;
}
