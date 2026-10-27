import type { EditorPosition } from '@adecore/editor';
import { KEY_PRIORITY } from './key-priority.ts';
import type { EditorLanguage } from './editor-language.ts';
import type { PickGroup, PickPreview } from './popups.ts';
import { realTimers, type Timers } from './timers.ts';

const PREVIEW_DELAY_MS = 120;

export interface PickSpec {
    readonly anchor: EditorPosition;
    readonly title?: string;
    readonly groups: readonly PickGroup[];
    /* The row the list opens on; the first one without it. */
    readonly active?: string;
    accept(id: string): void;
    /* A list can hand Tab back to its surrounding workflow after it closes. */
    onTab?(backwards: boolean): void;
    /*
     * Asked before the list closes on a row. A reason it cannot be taken keeps the list open with the reason
     * under it, the way a rename keeps its input; null lets the list close and `accept` run.
     */
    attempt?(id: string): Promise<string | null>;
    /* What the active row would change, asked a moment after it became active. */
    preview?(id: string, signal: AbortSignal): Promise<PickPreview | null>;
    /*
     * Typing narrows the rows to those whose `search` (the label without one) contains the query, whatever the case, and
     * the list stays open while a person types. Backspace edits the query.
     */
    readonly filter?: boolean;
    /* Shift with the arrows or a press chooses a run of rows, and Mod with a press adds or takes away one. */
    readonly multiple?: boolean;
    /* Enter takes the chosen rows, or the active one when none is chosen; without it Enter calls `accept` with the active row. */
    acceptMany?(ids: readonly string[]): void;
    /* Delete takes the chosen rows, or the active one, out of the list, and so does Backspace when there is no query. It answers the rows that remain. */
    remove?(ids: readonly string[]): readonly PickGroup[];
}

/*
 * The one list an editor has open under a character, for code actions, the places a name is defined and
 * the like. The editor keeps the focus: arrows move through the rows, Enter takes the active one and
 * Escape, typing, a click elsewhere or a change of the text close it.
 */
export class PickFeature {
    private readonly language: EditorLanguage;
    private readonly timers: Timers;
    private spec: PickSpec | null = null;

    /* The rows as the spec gave them, or as `remove` left them; `ids` are those a query lets through. */
    private groups: readonly PickGroup[] = [];

    private ids: readonly string[] = [];
    private active = '';
    private query = '';

    /* The rows chosen as a run or one by one, in list order, and the row a run of them grows from. */
    private chosen: readonly string[] = [];

    private rangeAnchor: string | null = null;
    private previewTimer: unknown;
    private controller: AbortController | null = null;

    /* The rows that said why they cannot be taken, by id. */
    private refusals = new Map<string, string>();

    private attempting = false;

    constructor(language: EditorLanguage, timers: Timers = realTimers) {
        this.language = language;
        this.timers = timers;
        const { editor } = language;

        const offs = [
            language.onKey((event) => this.key(event), KEY_PRIORITY.pick),
            editor.onTextChange(() => this.close()),
            editor.onCaret(() => this.close()),
            editor.onBlur(() => this.close())
        ];

        language.onDispose(() => {
            for (const off of offs) {
                off();
            }

            this.close();
        });
    }

    get isOpen(): boolean {
        return this.spec !== null;
    }

    open(spec: PickSpec): void {
        this.close();
        const ids = spec.groups.flatMap((group) => group.rows.map((row) => row.id));

        if (ids.length === 0) {
            return;
        }

        this.spec = spec;
        this.refusals = new Map();
        this.groups = spec.groups;
        this.query = '';
        this.chosen = [];
        this.rangeAnchor = null;
        this.ids = ids;
        this.active = spec.active !== undefined && ids.includes(spec.active) ? spec.active : ids[0]!;
        this.publish(null);
        this.schedulePreview();
    }

    close(): void {
        if (this.spec === null) {
            return;
        }

        this.spec = null;
        this.timers.clear(this.previewTimer);
        this.controller?.abort();
        this.controller = null;
        this.language.popups.setState({ pick: null });
    }

    /* Moves the active row; with `extend`, in a list of several choices, the rows between where the move began and the new row are chosen. */
    move(delta: number, extend = false): void {
        if (this.ids.length === 0) {
            return;
        }

        const index = this.ids.indexOf(this.active);
        const id = this.ids[Math.max(0, Math.min(this.ids.length - 1, index + delta))]!;

        if (extend && this.spec?.multiple === true) {
            this.extendTo(id);

            return;
        }

        this.settle(id);
    }

    /* Makes `id` the only row the list is on. */
    private settle(id: string): void {
        const hadChosen = this.chosen.length > 0;

        this.chosen = [];
        this.rangeAnchor = null;
        this.activate(id, hadChosen);
    }

    /* Takes a row, by a click or Enter. In a list of several choices a press with Shift chooses the run up to the row, and one with Mod adds or takes away the row. */
    choose(id: string, modifiers: { readonly toggle?: boolean; readonly range?: boolean } = {}): void {
        const spec = this.spec;

        if (spec === null || !this.ids.includes(id) || this.attempting) {
            return;
        }

        if (spec.multiple === true && modifiers.range === true) {
            this.extendTo(id);

            return;
        }

        if (spec.multiple === true && modifiers.toggle === true) {
            this.toggle(id);

            return;
        }

        if (spec.attempt === undefined) {
            this.close();
            spec.accept(id);

            return;
        }

        this.attempting = true;

        void spec
            .attempt(id)
            .catch(() => null)
            .then((reason) => {
                this.attempting = false;

                if (this.spec !== spec) {
                    return;
                }

                if (reason === null) {
                    this.close();
                    spec.accept(id);

                    return;
                }

                this.refusals.set(id, reason);
                this.publish(null);
            });
    }

    private activate(id: string, force = false): void {
        const moved = id !== this.active;

        this.active = id;

        if (moved) {
            this.controller?.abort();
            this.schedulePreview();
        }

        if (moved || force) {
            this.publish(null);
        }
    }

    private extendTo(id: string): void {
        const anchor = this.rangeAnchor ?? this.active;
        const first = this.ids.indexOf(anchor);
        const last = this.ids.indexOf(id);
        const run = this.ids.slice(Math.min(first, last), Math.max(first, last) + 1);

        this.rangeAnchor = anchor;
        this.chosen = run.length > 1 ? run : [];
        this.activate(id, true);
    }

    private toggle(id: string): void {
        const held = this.chosen.length > 0 ? this.chosen : [this.active];
        const next = held.includes(id) ? held.filter((other) => other !== id) : [...held, id];

        this.chosen = this.ids.filter((other) => next.includes(other));
        this.rangeAnchor = id;
        this.activate(id, true);
    }

    /* Enter: the chosen rows, or the active one when none is chosen. */
    private takeActive(): void {
        const spec = this.spec;

        if (spec?.acceptMany === undefined) {
            this.choose(this.active);

            return;
        }

        const ids = this.chosen.length > 0 ? this.chosen : [this.active];

        if (this.active !== '' && !this.attempting) {
            this.close();
            spec.acceptMany(ids);
        }
    }

    private visibleGroups(): readonly PickGroup[] {
        const query = this.query.toLowerCase();

        if (query === '') {
            return this.groups;
        }

        return this.groups
            .map((group) => ({ ...group, rows: group.rows.filter((row) => (row.search ?? row.label).toLowerCase().includes(query)) }))
            .filter((group) => group.rows.length > 0);
    }

    /* The query changed: the rows it lets through, with the first of them active. */
    private requery(query: string): void {
        this.query = query;
        this.ids = this.visibleGroups().flatMap((group) => group.rows.map((row) => row.id));
        this.chosen = [];
        this.rangeAnchor = null;
        this.active = this.ids[0] ?? '';
        this.controller?.abort();
        this.publish(null);
        this.schedulePreview();
    }

    /* Takes the chosen rows, or the active one, out of the list; the list closes when no row is left. */
    private removeChosen(): void {
        const spec = this.spec;

        if (spec?.remove === undefined || this.active === '') {
            return;
        }

        const removed = this.chosen.length > 0 ? this.chosen : [this.active];
        const index = this.ids.indexOf(removed[0]!);
        this.groups = spec.remove(removed);

        if (this.groups.every((group) => group.rows.length === 0)) {
            this.close();

            return;
        }

        this.ids = this.visibleGroups().flatMap((group) => group.rows.map((row) => row.id));
        this.chosen = [];
        this.rangeAnchor = null;
        this.active = this.ids[Math.min(index, this.ids.length - 1)] ?? '';
        this.controller?.abort();
        this.publish(null);
        this.schedulePreview();
    }

    private key(event: KeyboardEvent): boolean {
        const spec = this.spec;

        if (spec === null || event.metaKey || event.ctrlKey || event.altKey) {
            return false;
        }

        switch (event.key) {
            case 'ArrowDown':
                this.move(1, event.shiftKey);

                return true;
            case 'ArrowUp':
                this.move(-1, event.shiftKey);

                return true;
            case 'PageDown':
                this.move(8);

                return true;
            case 'PageUp':
                this.move(-8);

                return true;
            case 'Home':
            case 'End':
                if (this.ids.length > 0) {
                    this.settle(event.key === 'Home' ? this.ids[0]! : this.ids[this.ids.length - 1]!);
                }

                return true;
            case 'Enter':
                this.takeActive();

                return true;
            case 'Delete':
                this.removeChosen();

                return spec.remove !== undefined;
            case 'Backspace':
                if (this.query !== '') {
                    this.requery(this.query.slice(0, -1));

                    return true;
                }

                this.removeChosen();

                return spec.remove !== undefined || spec.filter === true;
            case 'Tab': {
                if (spec.onTab !== undefined) {
                    this.close();
                    spec.onTab(event.shiftKey);
                } else {
                    this.choose(this.active);
                }

                return true;
            }
            case 'Escape':
                this.close();

                return true;
            default:
                if (spec.filter === true && event.key.length === 1) {
                    this.requery(this.query + event.key);

                    return true;
                }

                return false;
        }
    }

    private schedulePreview(): void {
        const spec = this.spec;
        this.timers.clear(this.previewTimer);

        if (spec?.preview === undefined || this.active === '') {
            return;
        }

        const id = this.active;

        this.previewTimer = this.timers.set(() => {
            const controller = new AbortController();
            this.controller = controller;

            spec.preview!(id, controller.signal)
                .then((preview) => {
                    if (this.spec === spec && this.active === id && !controller.signal.aborted) {
                        this.publish(preview);
                    }
                })
                .catch(() => undefined);
        }, PREVIEW_DELAY_MS);
    }

    private publish(preview: PickPreview | null): void {
        const spec = this.spec;

        if (spec === null) {
            return;
        }

        const refusal = this.refusals.get(this.active);
        const shown = refusal === undefined ? preview : { removed: [], added: [], note: null, refusal };

        this.language.popups.setState({
            pick: {
                anchor: spec.anchor,
                groups: this.visibleGroups(),
                active: this.active,
                preview: shown,
                title: spec.title ?? null,
                query: spec.filter === true ? this.query : null,
                chosen: this.chosen
            }
        });
    }
}
