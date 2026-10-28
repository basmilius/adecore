import type { EditorPosition, EditorTextChange } from '@adecore/editor';
import type { EditPlace } from './edit-locations.ts';
import type { EditorLanguage } from './editor-language.ts';
import { KEY_PRIORITY } from './key-priority.ts';
import type { Place } from './navigation-history.ts';
import { isShortcut } from './shortcut-keys.ts';

/* Back, Forward and the list of recent locations over the history the whole project shares. */
export class HistoryFeature {
    private readonly language: EditorLanguage;
    private editing = false;

    constructor(language: EditorLanguage) {
        this.language = language;

        const off = language.onKey((event) => {
            if (isShortcut(this.language.shortcuts.historyBack, event)) {
                this.back();

                return true;
            }

            if (isShortcut(this.language.shortcuts.historyForward, event)) {
                this.forward();

                return true;
            }

            if (isShortcut(this.language.shortcuts.recentLocations, event)) {
                this.recent();

                return true;
            }

            if (isShortcut(this.language.shortcuts.lastEditLocation, event)) {
                this.lastEdit();

                return true;
            }

            if (isShortcut(this.language.shortcuts.nextEditLocation, event)) {
                this.nextEdit();

                return true;
            }

            return false;
        }, KEY_PRIORITY.history);

        // A jump of the editor's own, such as Method Down, is a place Back returns to like any other jump.
        const navigations = language.editor.onNavigate?.((from) => language.project.history.record({ uri: language.uri, position: from }));
        const changes = language.editor.onTextChange((change) => this.edited(change));
        const carets = language.editor.onCaret((position) => this.moved(position));

        language.onDispose(() => {
            off();
            navigations?.();
            changes();
            carets();
        });
    }

    /* Goes to where the project was edited before the carets' place; false when there is no such place. */
    lastEdit(): boolean {
        return this.visitEdit(this.language.project.edits.previous(this.currentEdit()));
    }

    /* Goes to where the project was edited after the place Last Edit Location came back to. */
    nextEdit(): boolean {
        return this.visitEdit(this.language.project.edits.next(this.currentEdit()));
    }

    /* Returns to where the caret was before the last jump; false when there is no such place. */
    back(): boolean {
        return this.visit(this.language.project.history.back(this.language.place));
    }

    forward(): boolean {
        return this.visit(this.language.project.history.forward(this.language.place));
    }

    /* Lists the places of the history under the caret; choosing one jumps there like any other jump. */
    recent(): void {
        const places = this.language.project.history.recent(this.language.place);

        this.language.locations(
            places.map((place) => ({ uri: place.uri, range: { start: place.position, end: place.position } })),
            this.language.editor.getCaret(),
            this.language.project.i18n.t('editor:language.history.recent')
        );
    }

    private currentEdit(): EditPlace {
        return { uri: this.language.uri, selections: this.language.editor.getSelections() };
    }

    /* Every edit moves the places of the file; one a person made counts as an edit location once the caret has settled. */
    private edited(change: EditorTextChange): void {
        const { editor, project, uri } = this.language;

        // The places belong to the file and the other editors of it hear the same change, so one editor moves them.
        if (project.holdsFirst(uri, editor)) {
            project.edits.map(uri, change.changes);
        }

        this.editing = true;

        queueMicrotask(() => {
            this.editing = false;

            if (change.source !== 'external' && editor.hasFocus?.() !== false && !this.language.isDisposed) {
                project.edits.record(this.currentEdit());
            }
        });
    }

    /* A caret that moves on its own ends the walk through the edits, unless an edit moved it. */
    private moved(position: EditorPosition): void {
        if (!this.editing) {
            this.language.project.edits.moved(this.language.uri, position);
        }
    }

    private visitEdit(place: EditPlace | null): boolean {
        if (place === null) {
            return false;
        }

        const { editor, project, uri } = this.language;

        if (place.uri === uri) {
            editor.setSelections(place.selections, 'center');
            editor.focus();
        } else {
            // Another file opens on one caret, the primary.
            project.openPlace({ uri: place.uri, position: place.selections.at(-1)!.end });
        }

        return true;
    }

    private visit(place: Place | null): boolean {
        if (place === null) {
            return false;
        }

        this.language.visit(place);

        return true;
    }
}
