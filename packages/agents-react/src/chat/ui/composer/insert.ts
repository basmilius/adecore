import type { EditorState, TransactionSpec } from '@codemirror/state';

function isSpace(text: string): boolean {
    return /^\s/.test(text);
}

/*
 * Text an app puts in the draft, over the selection, as if it were typed there. A space keeps it apart
 * from a word it would touch, and one after it at the end of the text lets the person type on.
 */
export function insertAtSelection(state: EditorState, text: string): TransactionSpec {
    if (text === '') {
        return {};
    }

    const { from, to } = state.selection.main;
    const before = state.doc.sliceString(Math.max(0, from - 1), from);
    const after = state.doc.sliceString(to, to + 1);
    const lead = before !== '' && !isSpace(before) && !isSpace(text) ? ' ' : '';
    const trail = (after === '' || !isSpace(after)) && !/\s$/.test(text) ? ' ' : '';
    const insert = `${lead}${text}${trail}`;

    return { changes: { from, to, insert }, selection: { anchor: from + insert.length }, scrollIntoView: true, userEvent: 'input' };
}

/* A sigil typed at the caret, so the picker it opens reads what follows it: a word after it is pushed a space away. */
export function insertSigil(state: EditorState, sigil: string): TransactionSpec {
    const { from, to } = state.selection.main;
    const before = state.doc.sliceString(Math.max(0, from - 1), from);
    const after = state.doc.sliceString(to, to + 1);
    const lead = before !== '' && !isSpace(before) ? ' ' : '';
    const trail = after !== '' && !isSpace(after) ? ' ' : '';
    const caret = from + lead.length + sigil.length;

    return { changes: { from, to, insert: `${lead}${sigil}${trail}` }, selection: { anchor: caret }, scrollIntoView: true, userEvent: 'input' };
}
