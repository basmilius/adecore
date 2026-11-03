import type { ChatToolItem } from '@adecore/agent-contracts';
import type { ToolLook, ToolLookMatch } from '../../host';
import type { CommandLookWord, LookRun } from './command-looks';
import { isRecord } from './json';
import { shellCommand } from './tools';

// A value keeps this many characters of what it says.
const FOLD_LENGTH = 40;
// An ACP agent titles a call of an MCP tool with the server and the tool, each agent with a separator of its own.
const TITLE_SEPARATORS = ['__', '_', '-'];
const TOOL_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const MCP_ENVELOPE = /^\{\s*"type"\s*:\s*"MCP"/;

/* A call of a tool on an MCP server, the same whichever CLI made it. */
export interface McpCall {
    readonly server: string;
    /* The tool's name on its server, without the server. */
    readonly tool: string;
    /* The arguments the tool got. */
    readonly input: Readonly<Record<string, unknown>>;
    /* What the tool answered, out of any envelope the CLI wraps it in. */
    readonly output: string | null;
}

/* A call of a look's MCP server read as a tool of its own. */
export interface ToolLookRun extends LookRun {
    readonly look: ToolLook;
    readonly match: ToolLookMatch;
    readonly call: McpCall;
}

const caches = new WeakMap<readonly ToolLook[], WeakMap<ChatToolItem, ToolLookRun | null>>();

function toolAfter(text: string, prefix: string): string | null {
    if (!text.startsWith(prefix)) {
        return null;
    }

    const tool = text.slice(prefix.length);

    return TOOL_NAME.test(tool) ? tool : null;
}

/* The tool and its arguments when `name` and `input` are a call on `server`, in any shape a CLI gives one. */
function callOn(server: string, name: string, input: Readonly<Record<string, unknown>>): Pick<McpCall, 'tool' | 'input'> | null {
    const named = toolAfter(name, `mcp__${server}__`) ?? toolAfter(name, `${server}/`);

    if (named !== null) {
        return { tool: named, input };
    }

    if (shellCommand(name, input) !== null) {
        return null;
    }

    // Grok runs every MCP tool through its `use_tool`, which names the tool in its input.
    const used = typeof input.tool_name === 'string' ? toolAfter(input.tool_name, `${server}__`) : null;

    if (used !== null) {
        return { tool: used, input: isRecord(input.tool_input) ? input.tool_input : {} };
    }

    const title = typeof input.description === 'string' ? input.description : null;
    const titled =
        title === null ? null : (TITLE_SEPARATORS.map((separator) => toolAfter(title, `${server}${separator}`)).find((tool) => tool !== null) ?? null);

    if (titled === null) {
        return null;
    }

    // Antigravity hands the arguments over as `arguments`, Copilot beside the title.
    return {
        tool: titled,
        input: isRecord(input.arguments) ? input.arguments : Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'description'))
    };
}

/* A tool's answer out of the envelope Grok puts around an MCP answer, `{"type":"MCP",...,"output":{"OkayOutput":"..."}}`. */
function unwrapped(output: string | null): string | null {
    if (output === null || !MCP_ENVELOPE.test(output)) {
        return output;
    }

    try {
        const parsed: unknown = JSON.parse(output);
        const inner = isRecord(parsed) && isRecord(parsed.output) ? Object.values(parsed.output) : [];

        return inner.length === 1 && typeof inner[0] === 'string' ? inner[0] : output;
    } catch {
        return output;
    }
}

/*
 * The call of an MCP tool on one of `servers` that `item` is: `mcp__<server>__<tool>` (Claude Code and
 * the API), `<server>/<tool>` (Codex), or an ACP call titled with the server and the tool (Grok's
 * `use_tool`, Antigravity, Copilot). Null for any other call.
 */
export function mcpCallOf(item: Pick<ChatToolItem, 'name' | 'input' | 'output'>, servers: readonly string[]): McpCall | null {
    const input = isRecord(item.input) ? item.input : {};

    for (const server of servers) {
        const call = callOn(server, item.name, input);

        if (call !== null) {
            return { server, ...call, output: unwrapped(item.output) };
        }
    }

    return null;
}

function folded(text: string): string {
    const line = text.replace(/\s+/g, ' ');

    return line.length > FOLD_LENGTH ? `${line.slice(0, FOLD_LENGTH)}…` : line;
}

function scalarText(value: unknown): string | null {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : null;
}

/* The lead and the fields of a call as `field=value`, each value a word a host may name; a value that is no text reads as `{…}` or `[…]`. */
function detailOf(match: ToolLookMatch, input: Readonly<Record<string, unknown>>): Pick<LookRun, 'detail' | 'words'> {
    let detail = match.lead ?? '';
    const words: CommandLookWord[] = [];

    for (const field of match.fields ?? Object.keys(input)) {
        const value = input[field];

        if (value === undefined || value === null) {
            continue;
        }

        detail += `${detail === '' ? '' : ' '}${field}=`;
        const values: unknown[] = Array.isArray(value) ? value : [value];
        const texts = values.map(scalarText).filter((text) => text !== null);

        if (texts.length < values.length) {
            detail += Array.isArray(value) ? '[…]' : '{…}';

            continue;
        }

        texts.forEach((text, index) => {
            const quoted = text === '' || /[\s",]/.test(text);
            detail += `${index === 0 ? '' : ','}${quoted ? '"' : ''}`;
            const start = detail.length;
            detail += folded(text);
            words.push({ start, end: detail.length, text, option: field });
            detail += quoted ? '"' : '';
        });
    }

    return { detail, words };
}

function read(item: ChatToolItem, looks: readonly ToolLook[]): ToolLookRun | null {
    const call = mcpCallOf(
        item,
        looks.map(({ server }) => server)
    );
    const look = call === null ? undefined : looks.find(({ server }) => server === call.server);
    const match = call === null || look === undefined ? null : look.describe(call.tool, call.input);

    if (call === null || look === undefined || match === null) {
        return null;
    }

    return {
        look,
        match,
        call,
        label: match.label,
        group: match.group,
        ...detailOf(match, call.input),
        code: [],
        others: [],
        more: 0,
        heredoc: false,
        shell: false
    };
}

/* The call of a look's MCP server that `item` is, read as that look's tool; null for any other call and one the look does not describe. */
export function matchToolLook(item: ChatToolItem, looks: readonly ToolLook[] | undefined): ToolLookRun | null {
    if (looks === undefined || looks.length === 0) {
        return null;
    }

    let cache = caches.get(looks);

    if (cache === undefined) {
        cache = new WeakMap();
        caches.set(looks, cache);
    }

    const known = cache.get(item);

    if (known !== undefined) {
        return known;
    }

    const run = read(item, looks);
    cache.set(item, run);

    return run;
}
