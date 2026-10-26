const WORD_START = /[\s\-_./:]/;

/* Whether `query` starts the text or one of its words. */
const startsWord = (text: string, query: string): boolean => {
    let at = text.indexOf(query);

    while (at !== -1) {
        if (at === 0 || WORD_START.test(text[at - 1]!)) {
            return true;
        }

        at = text.indexOf(query, at + 1);
    }

    return false;
};

const lettersInOrder = (text: string, query: string): boolean => {
    let at = 0;

    for (const letter of query.replace(/\s+/g, '')) {
        at = text.indexOf(letter, at);

        if (at === -1) {
            return false;
        }

        at += 1;
    }

    return true;
};

/*
 * How well `text` answers to what a person typed, ignoring case: 5 when it starts with the query,
 * 4 when one of its words does, 3 when every typed word is in it and it starts with the first,
 * 2 when every typed word is in it in any order, 1 when the letters are in it in order, and `null`
 * when it does not match. An empty query matches everything with 0.
 */
export function matchScore(text: string, query: string): number | null {
    const wanted = query.trim().toLowerCase();

    if (wanted === '') {
        return 0;
    }

    const haystack = text.toLowerCase();

    if (haystack.startsWith(wanted)) {
        return 5;
    }

    if (startsWord(haystack, wanted)) {
        return 4;
    }

    const words = wanted.split(/\s+/);

    if (words.every((word) => haystack.includes(word))) {
        return haystack.startsWith(words[0]!) ? 3 : 2;
    }

    return lettersInOrder(haystack, wanted) ? 1 : null;
}
