import { chipText, tokenizeChips, tokenizeNamedReferences, type ChipSegment, type ReferenceToken } from '../mentions';

/* Just the part of hast this plugin touches; the package's own types are not a dependency here. */
interface HastText {
    type: 'text';
    value: string;
}

interface HastElement {
    type: 'element';
    tagName: string;
    properties: Record<string, unknown>;
    children: HastNode[];
}

type HastNode = HastText | HastElement | { type: 'comment' | 'doctype' | 'raw'; value?: string };

interface HastParent {
    children: HastNode[];
}

export interface ChipOptions {
    mentions?: string[];
    skills?: string[];
    references?: readonly ReferenceToken[];
}

export interface NamedReferenceOptions {
    items: readonly ReferenceToken[];
    /* Ids a person pointed at with `#` in the thread, which win over another of the same name. */
    referenced?: readonly string[];
}

function valueOf(segment: Exclude<ChipSegment, { kind: 'text' }>): string {
    if (segment.kind === 'mention') {
        return segment.path;
    }

    if (segment.kind === 'model' || segment.kind === 'account') {
        return `${segment.cli}/${segment.id}`;
    }

    return segment.kind === 'skill' ? segment.name : segment.id;
}

// What every named chip starts with, so a text without one skips the walk.
const NAMED_CHIP_HINT = /@(model|account):/;

// Inline code overrules a chip: `@a.ts` between backticks is code, not a mention.
const SKIPPED = new Set(['code', 'pre']);

// A link already leads somewhere of its own.
const SKIPPED_IN_REPLIES = new Set(['code', 'pre', 'a']);

/* A chip as an element: the renderer reads `data-chip` and `data-value` (a reference's id), the text keeps the sigil. */
function chipElement(segment: Exclude<ChipSegment, { kind: 'text' }>): HastElement {
    return {
        type: 'element',
        tagName: 'span',
        properties: { dataChip: segment.kind, dataValue: valueOf(segment) },
        children: [{ type: 'text', value: chipText(segment) }]
    };
}

function textOf(node: HastParent | HastNode): string {
    if ('children' in node) {
        return node.children.map(textOf).join('');
    }

    return node.type === 'text' ? node.value : '';
}

function split(parent: HastParent, tokenize: (text: string) => ChipSegment[], skipped: ReadonlySet<string>): void {
    parent.children = parent.children.flatMap((child): HastNode[] => {
        if (child.type === 'text') {
            return tokenize(child.value).map((segment) => (segment.kind === 'text' ? { type: 'text', value: segment.text } : chipElement(segment)));
        }

        if (child.type === 'element' && !skipped.has(child.tagName)) {
            split(child, tokenize, skipped);
        }

        return [child];
    });
}

/* The `@path`, `$name` and `#name` tokens a person picked in the composer, and every model and account it spells, cut out of the text as chips. */
export function rehypeChips({ mentions = [], skills = [], references = [] }: ChipOptions = {}) {
    return (tree: HastParent) => {
        if (mentions.length === 0 && skills.length === 0 && references.length === 0 && !NAMED_CHIP_HINT.test(textOf(tree))) {
            return;
        }

        split(tree, (text) => tokenizeChips(text, mentions, skills, references), SKIPPED);
    };
}

/* The `#Name` a reply spells for a view, node or chat by exactly its name, cut out of the text as chips. */
export function rehypeNamedReferences({ items, referenced = [] }: NamedReferenceOptions) {
    return (tree: HastParent) => {
        if (items.length === 0) {
            return;
        }

        split(tree, (text) => (text.includes('#') ? tokenizeNamedReferences(text, items, referenced) : [{ kind: 'text', text }]), SKIPPED_IN_REPLIES);
    };
}
