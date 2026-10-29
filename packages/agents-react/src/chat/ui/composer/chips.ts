import type { ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { syntaxTree } from '@codemirror/language';
import { Facet, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import type { ReferenceIconProps } from '../../../host';
import type { ReferableKind } from '../../chat-references';
import { chipRanges, type ReferenceToken } from '../../mentions';
import { CHIP_IN_EDITOR, MENTION_TONE, REFERENCE_TONE, SKILL_TONE, TOKEN_ICON_IN_EDITOR } from '../chips';
import { referenceGlyph } from '../reference-icons';
import { codeRanges } from './editor';

export interface ChipChoices {
    mentions: string[];
    skills: string[];
    /* Null for a kind the host no longer names, which draws the chip without its mark. */
    references?: ReadonlyArray<ReferenceToken & { kind: ReferableKind | null }>;
    /* The host's mark of a reference, which the editor draws outside the host's provider. */
    referenceIcon?: ComponentType<ReferenceIconProps> | null;
}

const NO_CHOICES: ChipChoices = { mentions: [], skills: [] };

const choices = Facet.define<ChipChoices, ChipChoices>({ combine: (values) => values[0] ?? NO_CHOICES });

const mentionMark = Decoration.mark({ class: `${MENTION_TONE} ${CHIP_IN_EDITOR}` });
const skillMark = Decoration.mark({ class: `${SKILL_TONE} ${CHIP_IN_EDITOR}` });
// Inclusive at the start, so the pill opens before the mark of the kind that replaces its `#` and holds it.
const referenceMark = Decoration.mark({ class: `${REFERENCE_TONE} ${CHIP_IN_EDITOR}`, inclusiveStart: true });

const roots = new WeakMap<HTMLElement, Root>();

/* The reference's mark in place of the `#`, the way a sent message draws it. */
class ReferenceIcon extends WidgetType {
    readonly id: string;
    readonly kind: ReferableKind;
    readonly hostIcon: ComponentType<ReferenceIconProps> | null;

    constructor(id: string, kind: ReferableKind, hostIcon: ComponentType<ReferenceIconProps> | null) {
        super();
        this.id = id;
        this.kind = kind;
        this.hostIcon = hostIcon;
    }

    override eq(other: ReferenceIcon): boolean {
        return other.id === this.id && other.kind === this.kind && other.hostIcon === this.hostIcon;
    }

    toDOM(): HTMLElement {
        const holder = document.createElement('span');
        holder.className = TOKEN_ICON_IN_EDITOR;
        const root = createRoot(holder);
        root.render(referenceGlyph(this.hostIcon, { id: this.id, kind: this.kind, size: 12 }));
        roots.set(holder, root);

        return holder;
    }

    override destroy(dom: HTMLElement): void {
        const root = roots.get(dom);
        roots.delete(dom);
        // The editor drops a widget inside React's own commit, where a root may not unmount at once.
        queueMicrotask(() => root?.unmount());
    }
}

function chipMarks(state: EditorState): DecorationSet {
    const { mentions, skills, references = [], referenceIcon = null } = state.facet(choices);
    const kinds = new Map(references.map((token) => [token.id, token.kind]));
    const marks: Range<Decoration>[] = [];

    // `@a.ts` in backticks is code, not a mention.
    for (const range of chipRanges(state.doc.toString(), mentions, skills, codeRanges(state), references)) {
        if (range.kind !== 'reference') {
            marks.push((range.kind === 'skill' ? skillMark : mentionMark).range(range.from, range.to));

            continue;
        }

        marks.push(referenceMark.range(range.from, range.to));
        const kind = kinds.get(range.value);

        if (kind !== undefined && kind !== null) {
            marks.push(Decoration.replace({ widget: new ReferenceIcon(range.value, kind, referenceIcon) }).range(range.from, range.from + 1));
        }
    }

    return Decoration.set(marks, true);
}

const chipField = StateField.define<DecorationSet>({
    create: chipMarks,
    // The parser finishes a long text after the edit that asked for it, and a code span it finds then unmakes a chip.
    update: (marks, tr) =>
        tr.docChanged || tr.startState.facet(choices) !== tr.state.facet(choices) || syntaxTree(tr.startState) !== syntaxTree(tr.state)
            ? chipMarks(tr.state)
            : marks,
    provide: (field) => EditorView.decorations.from(field)
});

/* Draws the chosen `@path`, `$name` and `#name` tokens as chips; a new `ChipChoices` object is what redraws them. */
export function chipDecorations(value: ChipChoices): Extension {
    return [choices.of(value), chipField];
}
