const letter = /\p{L}/u;
const upper = /\p{Lu}/u;
const lower = /\p{Ll}/u;

/*
 * Gives a replacement the case of the text it replaces: the first letter follows the first letter of
 * the match, and the rest follows the tail of the match when that is all upper or all lower case and
 * the replacement's own tail is not already the other way. The platform's "Preserve case" for a replace.
 */
export function replaceWithCaseRespect(replacement: string, found: string): string {
    if (found === '' || replacement === '') {
        return replacement;
    }
    const [firstFound] = found;
    const [firstReplacement] = replacement;
    const head = upper.test(firstFound!) ? firstReplacement!.toUpperCase() : firstReplacement!.toLowerCase();
    const replacementTail = replacement.slice(firstReplacement!.length);
    if (replacementTail === '') {
        return head;
    }
    const foundTail = found.slice(firstFound!.length);
    if (foundTail === '') {
        return head + replacementTail;
    }
    const replacementCase = letterCase(replacementTail);
    const foundCase = letterCase(foundTail);
    // A tail without letters, like `x2`, follows the first letter of the match.
    const tailUpper = foundCase.hasLetters ? foundCase.upper : upper.test(firstFound!);
    const tailLower = foundCase.hasLetters ? foundCase.lower : lower.test(firstFound!);
    if (tailUpper && (replacementCase.lower || !replacementCase.upper)) {
        return head + replacementTail.toUpperCase();
    }
    if (tailLower && (replacementCase.lower || replacementCase.upper)) {
        return head + replacementTail.toLowerCase();
    }
    return head + replacementTail;
}

/* Whether every letter of `text` is upper case and whether every one is lower case; both hold without letters. */
function letterCase(text: string): { upper: boolean; lower: boolean; hasLetters: boolean } {
    let allUpper = true;
    let allLower = true;
    let hasLetters = false;
    for (const character of text) {
        if (!letter.test(character)) {
            continue;
        }
        hasLetters = true;
        allUpper &&= upper.test(character);
        allLower &&= lower.test(character);
        if (!allUpper && !allLower) {
            break;
        }
    }
    return { upper: allUpper, lower: allLower, hasLetters };
}
