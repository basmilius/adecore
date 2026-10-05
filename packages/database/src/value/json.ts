/* JSON detection and layout. Numbers stay as the text the server wrote, so a 64-bit integer is not rounded by a parse. */

const INDENT = '  ';

export type JsonCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export const checkJson = (text: string): JsonCheck => {
    try {
        JSON.parse(text);
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
};

/* Whether a string is a JSON object or array. A scalar such as `42` or `"x"` is a plain value, not a document. */
export const isJsonDocument = (text: string): boolean => {
    const start = text.trimStart()[0];
    return (start === '{' || start === '[') && checkJson(text).ok;
};

/* The text laid out with two spaces per level, or `null` when it is not JSON. */
export const prettyJson = (text: string): string | null => {
    if (!checkJson(text).ok) {
        return null;
    }

    let output = '';
    let depth = 0;
    let i = 0;
    const lineBreak = () => `\n${INDENT.repeat(depth)}`;
    const nextToken = (from: number): string => {
        let at = from;
        while (/\s/.test(text[at] ?? '')) {
            at++;
        }
        return text[at] ?? '';
    };

    while (i < text.length) {
        const char = text[i]!;
        if (char === '"') {
            let end = i + 1;
            while (text[end] !== '"') {
                end += text[end] === '\\' ? 2 : 1;
            }
            output += text.slice(i, end + 1);
            i = end + 1;
            continue;
        }
        if (char === '{' || char === '[') {
            const empty = nextToken(i + 1) === (char === '{' ? '}' : ']');
            output += char;
            if (empty) {
                output += char === '{' ? '}' : ']';
                i = text.indexOf(char === '{' ? '}' : ']', i + 1) + 1;
                continue;
            }
            depth++;
            output += lineBreak();
        } else if (char === '}' || char === ']') {
            depth--;
            output += `${lineBreak()}${char}`;
        } else if (char === ',') {
            output += `,${lineBreak()}`;
        } else if (char === ':') {
            output += ': ';
        } else if (!/\s/.test(char)) {
            output += char;
        }
        i++;
    }
    return output.trim();
};
