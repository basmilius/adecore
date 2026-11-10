import { wordChanges } from '@adecore/merge';

/*
 * The `[start, end)` ranges of each of `lines` that differ from the line of `replaced` it stands for. Lines pair up
 * only when there are as many of each; any other change has no pairing and marks no words.
 */
export function replacedWords(lines: readonly string[], replaced: readonly string[]): Array<Array<[number, number]>> {
    return lines.map((line, index) => (lines.length === replaced.length ? changedRanges(line, replaced[index]!) : []));
}

/* The words of `line` that `replaced` does not have, without the space around them; a change of spacing marks nothing. */
function changedRanges(line: string, replaced: string): Array<[number, number]> {
    const words = wordChanges(replaced, line);

    return (words?.new ?? []).flatMap((range): Array<[number, number]> => {
        const text = line.slice(range.from, range.to);
        const trimmed = text.trim();

        if (trimmed === '') {
            return [];
        }

        const start = range.from + (text.length - text.trimStart().length);

        return [[start, start + trimmed.length]];
    });
}
