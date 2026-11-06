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

function isBoundary(char: string | undefined): boolean {
    return char === undefined || /\s/.test(char);
}

function isTokenEnd(char: string | undefined): boolean {
    return isBoundary(char) || /[.,;:!?)]/.test(char!);
}

/* Where a `$name` of a known skill sits in the text, as a whole token; -1 when it does not. */
function findSkillToken(text: string, name: string, from: number): number {
    const token = `$${name}`;
    let index = text.indexOf(token, from);

    while (index >= 0) {
        if (isBoundary(text[index - 1]) && isTokenEnd(text[index + token.length])) {
            return index;
        }

        index = text.indexOf(token, index + 1);
    }

    return -1;
}

/* The last `$name` in the text that names one of the skills, longest name first on a tie. */
export function lastSkillToken(text: string, skills: string[]): { index: number; name: string } | null {
    let best: { index: number; name: string } | null = null;

    for (const name of [...new Set(skills)].sort((a, b) => b.length - a.length)) {
        let index = findSkillToken(text, name, 0);

        while (index >= 0) {
            if (best === null || index > best.index) {
                best = { index, name };
            }

            index = findSkillToken(text, name, index + 1);
        }
    }

    return best;
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

    const lead = text.replace(/\$([A-Za-z][A-Za-z0-9_:-]*)/g, (match, name: string) => (skills.includes(name) ? `/${name}` : match));

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
