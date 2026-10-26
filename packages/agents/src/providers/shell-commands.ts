// Unquoted, each of these makes the shell do more than run a word list: a pipe, a redirect, an expansion,
// a subshell or group, a glob, a comment or a history or negation mark.
const REFUSED = new Set(['|', '>', '<', '$', '`', '(', ')', '{', '}', '*', '?', '[', '~', '#', '!']);

/*
 * Whether a shell command line is only simple commands, joined by `&&`, `||`, `;` or newlines, each of
 * which starts with one of `allowed`. Anything the tokenizer cannot prove simple answers false, so a
 * true is safe to act on without a person.
 */
export function isOnlyCommands(command: string, allowed: readonly string[]): boolean {
    let word = '';
    let inWord = false;
    let words: string[] = [];
    let commands = 0;
    // A separator that still needs a command after it; a trailing `;` or newline needs none.
    let dangling = false;

    const endWord = (): void => {
        if (inWord) {
            words.push(word);
        }
        word = '';
        inWord = false;
    };

    const endCommand = (separator: string): boolean => {
        endWord();
        if (words.length === 0) {
            // Blank lines are fine, and so is a newline after `&&` or `||`; an empty command before any other separator is not.
            return separator === '\n';
        }
        if (!allowed.includes(words[0]!)) {
            return false;
        }
        commands++;
        words = [];
        dangling = separator === '&&' || separator === '||';
        return true;
    };

    for (let i = 0; i < command.length; i++) {
        const char = command[i]!;
        const next = command[i + 1];
        if (char === ' ' || char === '\t') {
            endWord();
            continue;
        }
        if (char === '\n' || char === ';') {
            if (!endCommand(char)) {
                return false;
            }
            continue;
        }
        if ((char === '&' || char === '|') && next === char) {
            if (!endCommand(char + next)) {
                return false;
            }
            i++;
            continue;
        }
        if (char === '&' || REFUSED.has(char)) {
            return false;
        }
        if (char === '\\') {
            if (next === undefined) {
                return false;
            }
            i++;
            if (next !== '\n') {
                word += next;
                inWord = true;
            }
            continue;
        }
        if (char === "'") {
            const close = command.indexOf("'", i + 1);
            if (close === -1) {
                return false;
            }
            word += command.slice(i + 1, close);
            inWord = true;
            i = close;
            continue;
        }
        if (char === '"') {
            inWord = true;
            let closed = false;
            for (i++; i < command.length; i++) {
                const quoted = command[i]!;
                if (quoted === '"') {
                    closed = true;
                    break;
                }
                if (quoted === '$' || quoted === '`') {
                    return false;
                }
                if (quoted === '\\') {
                    const escaped = command[i + 1];
                    if (escaped === undefined) {
                        return false;
                    }
                    i++;
                    if (escaped === '"' || escaped === '\\' || escaped === '$' || escaped === '`') {
                        word += escaped;
                    } else if (escaped !== '\n') {
                        word += quoted + escaped;
                    }
                    continue;
                }
                word += quoted;
            }
            if (!closed) {
                return false;
            }
            continue;
        }
        word += char;
        inWord = true;
    }
    return endCommand('\n') && commands > 0 && !dangling;
}
