import type { AgentKind } from '@adecore/agent-contracts';
import { syntaxTree } from '@codemirror/language';
import { Facet, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { createElement, Fragment, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MarkGlyph } from '../../../agents/AgentIcon';
import { CliMark } from '../../../agents/AgentModelLabel';
import type { HostSkill, ReferenceIconProps } from '../../../host/host';
import type { ReferableKind, ReferenceStep } from '../../../host/references';
import { chipRanges, namedChipParts, withNamedChips, type ReferenceToken } from '../../mentions';
import { CHIP_IN_EDITOR, MENTION_TONE, REFERENCE_TONE, SKILL_TONE, TOKEN_ICON_IN_EDITOR } from '../chips';
import type { NamedChipLook, NamedChipLookup } from '../named-chip-look';
import { referenceGlyph } from '../reference-icons';
import { ReferenceTrail } from '../ReferenceTrail';
import { codeRanges } from './editor';

interface ChipChoices {
    mentions: string[];
    skills: string[];
    /* Null for a kind the host no longer names, which draws the chip without its mark. */
    references?: ReadonlyArray<ReferenceToken & { kind: ReferableKind | null; trail?: readonly ReferenceStep[] }>;
    /* The host's mark of a reference, which the editor draws outside the host's provider. */
    referenceIcon?: ComponentType<ReferenceIconProps> | null;
    /* How a model or an account reads; without it a named chip shows its id. */
    named?: NamedChipLookup | null;
    /* The host's own skills, whose chips show their title under the host's mark. */
    hostSkills?: readonly HostSkill[];
}

const NO_CHOICES: ChipChoices = { mentions: [], skills: [] };

const choices = Facet.define<ChipChoices, ChipChoices>({ combine: (values) => values[0] ?? NO_CHOICES });

const mentionMark = Decoration.mark({ class: `${MENTION_TONE} ${CHIP_IN_EDITOR}` });
const skillMark = Decoration.mark({ class: `${SKILL_TONE} ${CHIP_IN_EDITOR}` });
// Inclusive at the start, so the pill opens before the mark of the kind that replaces its `#` and holds it.
const referenceMark = Decoration.mark({ class: `${REFERENCE_TONE} ${CHIP_IN_EDITOR}`, inclusiveStart: true });

const roots = new WeakMap<HTMLElement, Root>();

class ReferenceIcon extends WidgetType {
    readonly id: string;
    readonly kind: ReferableKind;
    readonly hostIcon: ComponentType<ReferenceIconProps> | null;
    readonly trail: readonly ReferenceStep[];

    constructor(id: string, kind: ReferableKind, hostIcon: ComponentType<ReferenceIconProps> | null, trail: readonly ReferenceStep[]) {
        super();
        this.id = id;
        this.kind = kind;
        this.hostIcon = hostIcon;
        this.trail = trail;
    }

    override eq(other: ReferenceIcon): boolean {
        return (
            other.id === this.id && other.kind === this.kind && other.hostIcon === this.hostIcon && JSON.stringify(other.trail) === JSON.stringify(this.trail)
        );
    }

    toDOM(): HTMLElement {
        const holder = document.createElement('span');
        const root = createRoot(holder);
        const glyph = referenceGlyph(this.hostIcon, { id: this.id, kind: this.kind, size: 12 });

        holder.className = this.trail.length > 0 ? 'inline' : TOKEN_ICON_IN_EDITOR;
        root.render(
            this.trail.length > 0
                ? createElement(
                      Fragment,
                      null,
                      createElement(ReferenceTrail, { trail: this.trail, hostIcon: this.hostIcon, size: 12, iconClassName: TOKEN_ICON_IN_EDITOR }),
                      createElement('span', { className: TOKEN_ICON_IN_EDITOR }, glyph)
                  )
                : glyph
        );
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

/*
 * A model or an account in place of its whole token: the CLI's mark in the color of the account it runs
 * on, and the name the machine knows it by. The token is one atom, so the caret steps over it whole.
 */
class NamedChipWidget extends WidgetType {
    readonly cli: AgentKind;
    readonly look: NamedChipLook;

    constructor(cli: AgentKind, look: NamedChipLook) {
        super();
        this.cli = cli;
        this.look = look;
    }

    override eq(other: NamedChipWidget): boolean {
        return (
            other.cli === this.cli && other.look.label === this.look.label && other.look.color === this.look.color && other.look.account === this.look.account
        );
    }

    toDOM(): HTMLElement {
        const chip = document.createElement('span');
        const mark = document.createElement('span');
        const root = createRoot(mark);

        chip.className = `${REFERENCE_TONE} ${CHIP_IN_EDITOR}`;
        mark.className = TOKEN_ICON_IN_EDITOR;

        if (this.look.color !== undefined) {
            mark.style.color = this.look.color;
        }

        root.render(createElement(CliMark, { kind: this.cli, size: 12 }));
        roots.set(chip, root);
        chip.append(mark);

        if (this.look.account !== undefined) {
            const account = document.createElement('span');

            account.className = 'text-text-muted';
            account.textContent = `${this.look.account} / `;
            chip.append(account);
        }

        chip.append(this.look.label);

        return chip;
    }

    override destroy(dom: HTMLElement): void {
        const root = roots.get(dom);
        roots.delete(dom);
        queueMicrotask(() => root?.unmount());
    }
}

/* A skill of the host's own in place of its `$name`: the host's mark and the title. One atom, like a named chip. */
class HostSkillWidget extends WidgetType {
    readonly skill: HostSkill;

    constructor(skill: HostSkill) {
        super();
        this.skill = skill;
    }

    override eq(other: HostSkillWidget): boolean {
        return other.skill.name === this.skill.name && other.skill.title === this.skill.title && other.skill.icon.path === this.skill.icon.path;
    }

    toDOM(): HTMLElement {
        const chip = document.createElement('span');
        const mark = document.createElement('span');
        const root = createRoot(mark);

        chip.className = `${SKILL_TONE} ${CHIP_IN_EDITOR}`;
        mark.className = TOKEN_ICON_IN_EDITOR;
        root.render(createElement(MarkGlyph, { mark: this.skill.icon, size: 12, decorative: true }));
        roots.set(chip, root);
        chip.append(mark, this.skill.title);

        return chip;
    }

    override destroy(dom: HTMLElement): void {
        const root = roots.get(dom);
        roots.delete(dom);
        queueMicrotask(() => root?.unmount());
    }
}

interface ChipMarks {
    marks: DecorationSet;
    /* The named chips, which the caret and a delete take whole. */
    atoms: DecorationSet;
}

function chipMarks(state: EditorState): ChipMarks {
    const { mentions, skills, references = [], referenceIcon = null, named = null, hostSkills = [] } = state.facet(choices);
    const tokens = new Map(references.map((token) => [token.id, token]));
    const hosted = new Map(hostSkills.map((skill) => [skill.name, skill]));
    const marks: Range<Decoration>[] = [];
    const atoms: Range<Decoration>[] = [];
    const text = state.doc.toString();
    const code = codeRanges(state);

    // `@a.ts` in backticks is code, not a mention.
    for (const range of withNamedChips(text, chipRanges(text, mentions, skills, code, references), code)) {
        if (range.kind === 'model' || range.kind === 'account') {
            // A named range always holds a `<cli>/`, since the pattern that found it requires one.
            const { cli, id, account } = namedChipParts(range.value)!;
            const look = named?.(range.kind, cli, id, account) ?? { label: id, color: undefined, account };
            const atom = Decoration.replace({ widget: new NamedChipWidget(cli as AgentKind, look) }).range(range.from, range.to);

            marks.push(atom);
            atoms.push(atom);

            continue;
        }

        const hostSkill = range.kind === 'skill' ? hosted.get(range.value) : undefined;

        if (hostSkill !== undefined) {
            const atom = Decoration.replace({ widget: new HostSkillWidget(hostSkill) }).range(range.from, range.to);

            marks.push(atom);
            atoms.push(atom);

            continue;
        }

        if (range.kind !== 'reference') {
            marks.push((range.kind === 'skill' ? skillMark : mentionMark).range(range.from, range.to));

            continue;
        }

        marks.push(referenceMark.range(range.from, range.to));
        const token = tokens.get(range.value);

        if (token?.kind !== undefined && token.kind !== null) {
            marks.push(
                Decoration.replace({ widget: new ReferenceIcon(range.value, token.kind, referenceIcon, token.trail ?? []) }).range(range.from, range.from + 1)
            );
        }
    }

    return { marks: Decoration.set(marks, true), atoms: Decoration.set(atoms, true) };
}

const chipField = StateField.define<ChipMarks>({
    create: chipMarks,
    // The parser finishes a long text after the edit that asked for it, and a code span it finds then unmakes a chip.
    update: (marks, tr) =>
        tr.docChanged || tr.startState.facet(choices) !== tr.state.facet(choices) || syntaxTree(tr.startState) !== syntaxTree(tr.state)
            ? chipMarks(tr.state)
            : marks,
    provide: (field) => [EditorView.decorations.from(field, (value) => value.marks), EditorView.atomicRanges.of((view) => view.state.field(field).atoms)]
});

/* Draws the chosen `@path`, `$name` and `#name` tokens as chips; a new `ChipChoices` object is what redraws them. */
export function chipDecorations(value: ChipChoices): Extension {
    return [choices.of(value), chipField];
}
