import type { ChatAttachment } from '@adecore/agent-contracts';

interface UserMessageInput {
    promptId?: string;
    text: string;
    attachments?: ChatAttachment[];
    // Written before the text, for what the CLI has no flag for (`ultrathink`).
    prefix?: string;
    // Skills the person picked with `$`; the CLI runs one, and only from its own last text block.
    skills?: string[];
}

function isTokenStart(char: string | undefined): boolean {
    return char === undefined || /[\s([{"']/.test(char);
}

function isTokenEnd(char: string | undefined): boolean {
    return char === undefined || /[\s.,;:!?)\]}"']/.test(char);
}

/*
 * The spans of the text that are code, as `[start, end)` pairs: a fenced block (an unclosed one runs
 * to the end) and an inline span closed by a run of the same number of backticks. A `$x` there is a
 * shell variable or a literal, never a skill.
 */
function codeRanges(text: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    let index = 0;

    while (index < text.length) {
        if (text[index] !== '`') {
            index++;

            continue;
        }

        let end = index;

        while (text[end] === '`') {
            end++;
        }

        const length = end - index;
        const atLineStart = index === 0 || text[index - 1] === '\n';

        if (length >= 3 && atLineStart) {
            const close = new RegExp(`\\n {0,3}\`{${length},}[ \\t]*(?=\\n|$)`, 'g');

            close.lastIndex = end;
            const match = close.exec(text);
            const stop = match === null ? text.length : match.index + match[0].length;

            ranges.push([index, stop]);
            index = stop;

            continue;
        }

        const closing = findBacktickRun(text, end, length);

        if (closing === -1) {
            index = end;

            continue;
        }

        ranges.push([index, closing + length]);
        index = closing + length;
    }

    return ranges;
}

/* The start of the next run of exactly `length` backticks from `from`; -1 when there is none. */
function findBacktickRun(text: string, from: number, length: number): number {
    let index = text.indexOf('`', from);

    while (index >= 0) {
        let end = index;

        while (text[end] === '`') {
            end++;
        }

        if (end - index === length) {
            return index;
        }

        index = text.indexOf('`', end);
    }

    return -1;
}

/*
 * Every `$name` in the text that names one of the skills and stands as a token of its own: after the
 * start, whitespace or an opening bracket or quote, before the end, whitespace or punctuation that
 * cannot continue a name, and outside code. The longest name wins where two share a start.
 */
function skillTokens(text: string, skills: string[]): Array<{ index: number; name: string }> {
    const code = codeRanges(text);
    const tokens: Array<{ index: number; name: string }> = [];

    for (const name of [...new Set(skills)].sort((a, b) => b.length - a.length)) {
        const token = `$${name}`;
        let index = text.indexOf(token, 0);

        while (index >= 0) {
            const inCode = code.some(([start, end]) => index >= start && index < end);

            if (!inCode && isTokenStart(text[index - 1]) && isTokenEnd(text[index + token.length]) && !tokens.some((other) => other.index === index)) {
                tokens.push({ index, name });
            }

            index = text.indexOf(token, index + 1);
        }
    }

    return tokens.sort((a, b) => a.index - b.index);
}

/* The last `$name` in the text that names one of the skills. */
export function lastSkillToken(text: string, skills: string[]): { index: number; name: string } | null {
    return skillTokens(text, skills).at(-1) ?? null;
}

/*
 * The text blocks a prompt with skills becomes. Claude Code expands a skill only from a text block
 * that starts with `/name` and is the last one in the message (verified against 2.1.267 with a
 * skill that writes a marker file). A prompt that opens with the skill is that block whole, the rest
 * its arguments. Anywhere else the words after it may be an instruction rather than arguments, and a
 * model reading the text before it as a message of its own took it as cut off, so the prompt stays
 * whole in front, every `$x` written as `/x`, and the invocation is the bare `/name`.
 */
export function splitSkillPrompt(text: string, skills: string[]): { lead: string; invocation: string | null } {
    const last = lastSkillToken(text, skills);

    if (last === null) {
        return { lead: text, invocation: null };
    }

    if (text.slice(0, last.index).trim() === '') {
        const rest = text.slice(last.index + last.name.length + 1).replace(/^[ \t]+/, '');

        return { lead: '', invocation: rest === '' ? `/${last.name}` : `/${last.name} ${rest}` };
    }

    let lead = '';
    let from = 0;

    for (const token of skillTokens(text, skills)) {
        lead += `${text.slice(from, token.index)}/${token.name}`;
        from = token.index + token.name.length + 1;
    }

    lead += text.slice(from);

    return { lead: lead.trim(), invocation: `/${last.name}` };
}

/* Paths stay in the prompt so the agent can also edit or copy the original attachments. */
export function attachmentNote(attachments: ChatAttachment[]): string {
    return attachments.length === 0 ? '' : `Attached files:\n${attachments.map((attachment) => `- ${attachment.path} (${attachment.name})`).join('\n')}`;
}

/*
 * The `user` frame the CLI reads on stdin. The message body is the Anthropic API shape: a content
 * array of text blocks, which the CLI passes through unchanged (checked against claude 2.1.266).
 * The attachments are named by path in the leading block, so the invocation of a skill stays last.
 */
export function buildUserMessage({ text, attachments = [], prefix = '', skills = [], promptId }: UserMessageInput): Record<string, unknown> {
    const content: unknown[] = [];
    const { lead, invocation } = splitSkillPrompt(text, skills);
    const note = attachmentNote(attachments);
    // The prefix must be the first thing the model reads, so it joins the leading block.
    const prompt = [`${prefix}${lead}`.trimEnd(), note].filter((part) => part.trim() !== '').join('\n\n');

    if (prompt !== '') {
        content.push({ type: 'text', text: prompt });
    }

    if (invocation !== null) {
        content.push({ type: 'text', text: invocation });
    }

    return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, session_id: '', ...(promptId ? { uuid: promptId } : {}) };
}
