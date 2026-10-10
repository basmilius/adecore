import type { EditorLanguage } from './editor-language.ts';

export type ClipboardAction = 'cut' | 'copy' | 'paste';

/*
 * The editor only says where its context menu was asked for; `EditorContextMenu` draws it from what the
 * servers support at the caret. The refactors are asked for while it opens, so it never waits for them.
 */
export class ContextMenuFeature {
    private readonly language: EditorLanguage;
    private request = 0;

    constructor(language: EditorLanguage) {
        this.language = language;
        const off = language.editor.onContextMenu((menu) => {
            // A right click outside the selection moves the caret first, so the menu is about what was clicked.
            if (!menu.inSelection) {
                language.editor.setCaret(menu.position);
            }
            this.open(menu.x, menu.y);
        });
        language.onDispose(() => {
            off();
            this.close();
        });
    }

    close(): void {
        this.request++;
        if (this.language.popups.getState().menu !== null) {
            this.language.popups.setState({ menu: null });
        }
    }

    /* The browser's own commands on the editor's input, which keep the clipboard and the undo history one thing. */
    clipboard(action: ClipboardAction): void {
        const { editor } = this.language;
        editor.focus();
        const done = document.execCommand(action);
        if (!done && action === 'paste') {
            void navigator.clipboard
                ?.readText()
                .then((text) => {
                    const range = editor.getSelection();
                    editor.applyEdits([{ range, text }]);
                })
                .catch(() => undefined);
        }
    }

    private open(x: number, y: number): void {
        const request = ++this.request;
        const { popups, codeActions } = this.language;
        popups.setState({ menu: { x, y, refactors: [] } });
        void codeActions.list(['refactor']).then((entries) => {
            const shown = popups.getState().menu;
            if (request === this.request && shown !== null && entries !== null) {
                popups.setState({ menu: { ...shown, refactors: entries } });
            }
        });
    }
}
