import { rememberCopy } from '@adecore/editor';
import type { ClipboardEntry } from './clipboard-history.ts';
import type { EditorLanguage } from './editor-language.ts';
import { KEY_PRIORITY } from './key-priority.ts';
import type { PickGroup } from './popups.ts';
import { isShortcut } from './shortcut-keys.ts';

const LABEL_LENGTH = 80;

/* The first characters of a copy on one line, with each line break shown as a return sign. */
function labelOf(text: string): string {
    const flat = text.replace(/\r\n|\r|\n/g, '⏎');

    return flat.length > LABEL_LENGTH ? `${flat.slice(0, LABEL_LENGTH)}…` : flat;
}

/*
 * Paste from History: a list of what was copied in the editors of the project, newest first. Typing narrows it,
 * Shift with the arrows chooses several entries, which paste as one, and Delete forgets entries.
 */
export class PasteHistoryFeature {
    private readonly language: EditorLanguage;

    constructor(language: EditorLanguage) {
        this.language = language;

        const off = language.onKey((event) => {
            if (!isShortcut(this.language.shortcuts.pasteFromHistory, event)) {
                return false;
            }

            this.open();

            return true;
        }, KEY_PRIORITY.pasteHistory);

        language.onDispose(off);
    }

    open(): void {
        const { editor, project } = this.language;
        const { clipboard } = project;

        if (clipboard.entries.length === 0) {
            editor.announce(project.i18n.t('editor:language.pasteHistory.empty'));

            return;
        }

        const ids = new Map<ClipboardEntry, string>();
        const entries = new Map<string, ClipboardEntry>();

        const groups = (): readonly PickGroup[] => [
            {
                title: null,
                rows: clipboard.entries.map((entry) => {
                    const id = ids.get(entry) ?? String(ids.size);

                    ids.set(entry, id);
                    entries.set(id, entry);

                    return { id, label: labelOf(entry.text), detail: '', search: entry.text };
                })
            }
        ];

        const rows = groups();

        this.language.pick.open({
            anchor: editor.getCaret(),
            title: project.i18n.t('editor:language.pasteHistory.title'),
            groups: rows,
            active: rows[0]!.rows[0]!.id,
            filter: true,
            multiple: true,
            accept: (id) => this.paste([entries.get(id)!]),
            acceptMany: (chosen) => this.paste(clipboard.entries.filter((entry) => chosen.includes(ids.get(entry) ?? ''))),
            preview: async (id) => ({ removed: [], added: entries.get(id)?.text.split('\n') ?? [], note: null, kind: 'text' }),
            remove: (chosen) => {
                for (const id of chosen) {
                    clipboard.remove(entries.get(id)!);
                }

                return groups();
            }
        });
    }

    /* Pastes entries in list order, joined by line breaks, as a paste of that text from the clipboard would. */
    private paste(chosen: readonly ClipboardEntry[]): void {
        const { editor, project } = this.language;
        const { clipboard } = project;

        if (chosen.length === 0) {
            return;
        }

        const text = chosen.map((entry) => entry.text).join('\n');
        const wholeLines = chosen.length === 1 && chosen[0]!.wholeLines;

        if (chosen.length === 1) {
            clipboard.promote(chosen[0]!);
        } else {
            clipboard.add(text);
        }

        globalThis.navigator?.clipboard?.writeText(text).catch(() => undefined);
        rememberCopy(text, wholeLines);
        editor.paste?.(text, { wholeLines });
    }
}
