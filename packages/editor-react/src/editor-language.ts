import { KEYMAP, type Keymap } from '@adecore/editor/keymap';
import type { Editor, EditorKeyHandler, EditorPosition } from '@adecore/editor';
import type { LanguageService, Location, TextDocumentSaveReason } from '@adecore/lsp';
import { DocumentColorsFeature } from './document-colors.ts';
import { DocumentLinksFeature } from './document-links.ts';
import { InlineCompletionFeature } from './inline-completion.ts';
import { LinkedEditingFeature } from './linked-editing.ts';
import { CallHierarchyFeature } from './call-hierarchy.ts';
import { CodeActionsFeature } from './code-actions.ts';
import { CodeVisionFeature } from './code-vision.ts';
import { CompletionFeature } from './completion.ts';
import { ContextMenuFeature } from './context-menu.ts';
import { DefinitionLinkFeature } from './definition-link.ts';
import { DiagnosticsFeature } from './diagnostics.ts';
import { FoldingFeature } from './folding.ts';
import { FormatOnTypeFeature } from './format-on-type.ts';
import { HighlightsFeature } from './highlights.ts';
import { HistoryFeature } from './history.ts';
import { HoverFeature } from './hover.ts';
import { KeyDispatcher } from './key-priority.ts';
import { MarkupFeature } from './markup.ts';
import { NavigationFeature, locationRow } from './navigation.ts';
import { PasteHistoryFeature } from './paste-history.ts';
import { PeekFeature } from './peek.ts';
import { PickFeature } from './pick.ts';
import { SymbolPickerFeature } from './symbol-picker.ts';
import { RenameFeature } from './rename.ts';
import { RenderedDocsFeature } from './rendered-docs.ts';
import { shortcutsOf } from './shortcut-keys.ts';
import { createPopupStore } from './popups.ts';
import { realTimers, type Timers } from './timers.ts';
import { InlayHintsFeature } from './inlay-hints.ts';
import { SelectionRangesFeature } from './selection-ranges.ts';
import { SemanticTokensFeature, type SemanticTokensOptions } from './semantic-tokens.ts';
import { SignatureFeature } from './signature.ts';
import { SnippetFeature } from './snippet-session.ts';
import { SurroundFeature } from './surround.ts';
import { SymbolsFeature } from './symbols.ts';
import { TemplatesFeature } from './live-templates.ts';
import type { Place } from './navigation-history.ts';
import type { LanguageDocumentHandle, ProjectLanguage } from './project-language.ts';

/* How long the edits servers want before a save are waited for. */
const SAVE_PARTICIPANT_MS = 1_000;

/* What an app tunes about the features of one editor. */
export interface EditorLanguageOptions {
    /* Where a document counts as large for semantic tokens. */
    semanticTokens?: SemanticTokensOptions;
    /* False for a document no server serves: it counts as open in the project and the features stay inert. True by default. */
    serve?: boolean;
}

/*
 * The one place that connects an editor to the language servers: it opens the file's document for
 * the editor and lets go of it again. Every language feature of the editor hangs off this object.
 */
export class EditorLanguage {
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
    readonly popups = createPopupStore();

    readonly diagnostics: DiagnosticsFeature;
    readonly hover: HoverFeature;
    readonly inlayHints: InlayHintsFeature;
    readonly completion: CompletionFeature;
    readonly signature: SignatureFeature;
    readonly snippets: SnippetFeature;
    readonly markup: MarkupFeature;
    readonly templates: TemplatesFeature;
    readonly surround: SurroundFeature;
    readonly highlights: HighlightsFeature;
    readonly pick: PickFeature;
    readonly codeActions: CodeActionsFeature;
    readonly rename: RenameFeature;
    readonly navigation: NavigationFeature;
    readonly peek: PeekFeature;
    readonly callHierarchy: CallHierarchyFeature;
    readonly symbolPicker: SymbolPickerFeature;
    readonly contextMenu: ContextMenuFeature;
    readonly history: HistoryFeature;
    readonly definitionLink: DefinitionLinkFeature;
    readonly symbols: SymbolsFeature;
    readonly codeVision: CodeVisionFeature;
    readonly formatOnType: FormatOnTypeFeature;
    readonly renderedDocs: RenderedDocsFeature;
    readonly pasteHistory: PasteHistoryFeature;
    readonly links: DocumentLinksFeature;
    readonly colors: DocumentColorsFeature;
    readonly linkedEditing: LinkedEditingFeature;
    readonly inlineCompletion: InlineCompletionFeature;
    private readonly disposers: Array<() => void> = [];
    private readonly keys = new KeyDispatcher();
    private readonly timers: Timers;
    private disposed = false;

    constructor(project: ProjectLanguage, editor: Editor, uri: string, languageId: string, timers: Timers = realTimers, options: EditorLanguageOptions = {}) {
        this.editor = editor;
        this.apple = project.host.apple ?? false;
        this.keymap = project.host.keymap ?? KEYMAP;
        this.shortcuts = shortcutsOf(this.keymap, this.apple);
        this.project = project;
        this.languageId = languageId;
        this.served = options.serve ?? true;
        this.document = project.acquire(uri, languageId, editor, { serve: this.served });
        this.timers = timers;
        this.onDispose(editor.onKeyDown((event) => this.keys.dispatch(event)));
        this.pick = new PickFeature(this, timers);
        this.diagnostics = new DiagnosticsFeature(this);
        this.hover = new HoverFeature(this, timers);
        this.completion = new CompletionFeature(this, timers);
        this.snippets = new SnippetFeature(this, timers);
        this.markup = new MarkupFeature(this);
        this.templates = new TemplatesFeature(this);
        this.surround = new SurroundFeature(this);
        this.signature = new SignatureFeature(this, timers);
        this.highlights = new HighlightsFeature(this, timers);
        this.symbols = new SymbolsFeature(this, timers);
        new SelectionRangesFeature(this);
        new SemanticTokensFeature(this, timers, options.semanticTokens);
        this.inlayHints = new InlayHintsFeature(this, timers);
        this.codeActions = new CodeActionsFeature(this, timers);
        this.rename = new RenameFeature(this);
        // Before navigation, whose Mod+click goes to a definition: a link under the pointer goes first.
        this.links = new DocumentLinksFeature(this, timers);
        this.colors = new DocumentColorsFeature(this, timers);
        this.linkedEditing = new LinkedEditingFeature(this, timers);
        this.inlineCompletion = new InlineCompletionFeature(this, timers);
        this.navigation = new NavigationFeature(this);
        this.peek = new PeekFeature(this, timers);
        this.callHierarchy = new CallHierarchyFeature(this, timers);
        this.symbolPicker = new SymbolPickerFeature(this);
        this.contextMenu = new ContextMenuFeature(this);
        this.history = new HistoryFeature(this);
        this.definitionLink = new DefinitionLinkFeature(this);
        this.codeVision = new CodeVisionFeature(this, (listener) => this.symbols.onResult(listener), timers);
        this.formatOnType = new FormatOnTypeFeature(this);
        this.renderedDocs = new RenderedDocsFeature(this, timers);
        this.pasteHistory = new PasteHistoryFeature(this);
        new FoldingFeature(this, (listener) => this.symbols.onResult(listener), timers);

        const copies = editor.onCopy?.((copy) => project.clipboard.add(copy.text, { wholeLines: copy.wholeLines }));

        if (copies !== undefined) {
            this.onDispose(copies);
        }

        editor.setWordSources?.(() => this.otherTexts());
        this.onDispose(() => editor.setWordSources?.(null));
        this.placeOpenedCaret(editor.getCaret());
        this.onDispose(editor.onCaret((position) => this.placeOpenedCaret(position)));
    }

    get uri(): string {
        return this.document.uri;
    }

    /* The service this document is asked through: the project's, or one that answers nothing when no server serves it. */
    get service(): LanguageService {
        return this.document.service;
    }

    get isDisposed(): boolean {
        return this.disposed;
    }

    /* Where the caret is, as a place the history can come back to. */
    get place(): Place {
        return { uri: this.uri, position: this.editor.getCaret() };
    }

    /* Takes the caret to a place the servers named, in this file or in another one that opens beside it, and remembers where it was. */
    goTo(location: Location): void {
        this.project.history.record(this.place);
        this.visit({ uri: location.uri, position: location.range.start });
    }

    /* Takes the caret to a position of this file and remembers where it was. */
    jump(position: EditorPosition): void {
        this.goTo({ uri: this.uri, range: { start: position, end: position } });
    }

    /* Goes to a place without touching the history, which is how Back and Forward move. */
    visit(place: Place): void {
        if (place.uri === this.uri) {
            this.editor.setCaret(place.position, 'center');
            this.editor.focus();
        } else {
            this.project.openPlace(place);
        }
    }

    /* Lists places under a position to choose from; choosing one goes there. */
    locations(places: readonly Location[], anchor: EditorPosition, title: string): void {
        const rows = places.map((place, index) => ({ id: String(index), ...locationRow(place, this.project.pathOfLocation(place.uri)) }));
        this.pick.open({ anchor, title, groups: [{ title: null, rows }], accept: (id) => this.goTo(places[Number(id)]!) });
    }

    /*
     * Runs `listener` once the document is open and again whenever the service says what it can ask for
     * this document changed. A service that is ready before the document opens never says so, so the
     * opening counts as the first change.
     */
    onProvidersChanged(listener: () => void): () => void {
        let listening = true;

        void this.document.ready.then(
            () => {
                if (listening && !this.disposed) {
                    listener();
                }
            },
            () => undefined
        );

        const providers = this.service.onProvidersChanged((uri) => {
            if (uri === this.uri) {
                listener();
            }
        });

        return () => {
            listening = false;
            providers.dispose();
        };
    }

    /*
     * Lets `handler` see the editor's keys before every handler of a lower `priority`, the first to take a key
     * winning. `KEY_PRIORITY` holds the features'; the default, 0, comes after all of them.
     */
    onKey(handler: EditorKeyHandler, priority = 0): () => void {
        return this.keys.add(handler, priority);
    }

    /*
     * Lets the servers in before the host writes the file: tells them a save is coming and applies the edits they
     * want made first, such as organized imports. A server that has not answered within a second is passed over,
     * as the specification allows. Call it, then save, then let the service send `didSave`.
     */
    async prepareSave(reason: TextDocumentSaveReason = 1): Promise<void> {
        const { service } = this;
        await service.willSave?.(this.uri, reason).catch(() => undefined);
        if (this.disposed || service.willSaveWaitUntil === undefined) {
            return;
        }
        const controller = new AbortController();
        const timer = this.timers.set(() => controller.abort(), SAVE_PARTICIPANT_MS);
        try {
            const edits = await service.willSaveWaitUntil(this.uri, reason, { signal: controller.signal });
            if (!this.disposed && !controller.signal.aborted && edits !== null && edits.length > 0) {
                this.editor.applyEdits(edits.map((edit) => ({ range: edit.range, text: edit.newText })));
            }
        } catch {
            // A server that fails or is too slow does not keep the file from being saved.
        } finally {
            this.timers.clear(timer);
        }
    }

    /* Runs `dispose` when the editor lets go of its document. */
    onDispose(dispose: () => void): void {
        this.disposers.push(dispose);
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (const dispose of this.disposers.splice(0).reverse()) {
            dispose();
        }

        this.document.release();
    }

    /* The texts of the other open editors of the project, which Hippie completion takes words from. */
    private otherTexts(): string[] {
        return this.project
            .openEditors()
            .filter((open) => open.uri !== this.uri)
            .map((open) => open.editor.getText());
    }

    /* A file opened from another one lands on the line; this puts the caret on the column the jump meant. */
    private placeOpenedCaret(position: EditorPosition): void {
        const column = this.project.takeCaret(this.uri, position.line);

        if (column !== null && column.character !== position.character) {
            this.editor.setCaret(column);

            return;
        }

        this.project.noteCaret({ uri: this.uri, position });
    }
}
