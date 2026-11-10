import type { ChatToolItem } from '@adecore/agent-contracts';
import { isRecord } from '@adecore/utils/record';
import type { ToolLook, ToolLookMatch } from '../../host/host';
import type { CommandLookWord, LookRun } from './command-looks';

const FOLD_LENGTH = 40;
// An ACP agent titles a call of an MCP tool with the server and the tool, each agent with a separator of its own.
const TITLE_SEPARATORS = ['__', '_', '-'];
const TOOL_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
// The name an ACP call of kind `other` gets, which is all a call of an MCP tool is where its agent marks none.
const ACP_TOOL_ROW = 'Tool';

/* A call of a tool on an MCP server, the same whichever CLI made it. */
interface McpCall {
    readonly server: string;
    readonly tool: string;
    readonly input: Readonly<Record<string, unknown>>;
    /* What the tool answered, out of any envelope the CLI wraps it in. */
    readonly output: string | null;
}

/* A call of a look's MCP server read as a tool of its own. */
interface ToolLookRun extends LookRun {
    readonly look: ToolLook;
    readonly match: ToolLookMatch;
    readonly call: McpCall;
}

const caches = new WeakMap<readonly ToolLook[], WeakMap<ChatToolItem, ToolLookRun | null>>();

/* The server and the tool `text` names as `<server><separator><tool>`, on the first of `servers` it starts with. */
function toolOn(text: string, servers: readonly string[], separators: readonly string[]): Pick<McpCall, 'server' | 'tool'> | null {
    for (const server of servers) {
        for (const separator of separators) {
            const prefix = `${server}${separator}`;
            const tool = text.slice(prefix.length);

            if (text.startsWith(prefix) && TOOL_NAME.test(tool)) {
                return { server, tool };
            }
        }
    }

    return null;
}

/*
 * The call as its name says it, whatever its input holds: `mcp__<server>__<tool>`, `<server>/<tool>`, or the tool
 * Grok's `use_tool` names in its input. Undefined where the name says nothing of a server, and null where it names
 * one that is not in `servers`, which no title overrules.
 */
function namedCall(name: string, input: Readonly<Record<string, unknown>>, servers: readonly string[]): Omit<McpCall, 'output'> | null | undefined {
    if (name.startsWith('mcp__')) {
        const named = toolOn(name.slice(5), servers, ['__']);

        return named === null ? null : { ...named, input };
    }

    if (name.includes('/')) {
        const named = toolOn(name, servers, ['/']);

        return named === null ? null : { ...named, input };
    }

    if (name !== ACP_TOOL_ROW || typeof input.tool_name !== 'string') {
        return undefined;
    }

    const used = toolOn(input.tool_name, servers, ['__']);

    return used === null ? null : { ...used, input: isRecord(input.tool_input) ? input.tool_input : {} };
}

/*
 * The call as an ACP agent that marks no server titles it, in the rows `toolRow` of `@adecore/agents` draws: a call
 * of kind `other`, or a `Read` Copilot makes of a tool that only reads. A `Read` of a file is no MCP call.
 */
function titledCall(name: string, input: Readonly<Record<string, unknown>>, servers: readonly string[]): Omit<McpCall, 'output'> | null {
    const titledRow = name === ACP_TOOL_ROW || (name === 'Read' && input.file_path === undefined);
    const title = typeof input.description === 'string' ? input.description : null;
    const titled = !titledRow || title === null ? null : toolOn(title, servers, TITLE_SEPARATORS);

    if (titled === null) {
        return null;
    }

    // Antigravity hands the arguments over as `arguments`, Copilot beside the title.
    return {
        ...titled,
        input: isRecord(input.arguments) ? input.arguments : Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'description'))
    };
}

/* A tool's answer out of the envelope Grok puts around an MCP answer, `{"type":"MCP",...,"output":{"OkayOutput":"..."}}`. */
function unwrapped(output: string | null): string | null {
    if (output === null || !output.trimStart().startsWith('{')) {
        return output;
    }

    try {
        const parsed: unknown = JSON.parse(output);

        if (!isRecord(parsed) || parsed.type !== 'MCP' || !isRecord(parsed.output)) {
            return output;
        }

        const inner = Object.values(parsed.output);

        return inner.length === 1 && typeof inner[0] === 'string' ? inner[0] : output;
    } catch {
        return output;
    }
}

/*
 * The call of an MCP tool on one of `servers` that `item` is: `mcp__<server>__<tool>` (Claude Code, the API and
 * an ACP agent that marks its server), `<server>/<tool>` (Codex), or an ACP call titled with the server and the
 * tool (Grok's `use_tool`, Copilot, and calls of agents from before they were marked). A name that says which
 * server is read before any title, over every server, the longest name first. Null for any other call.
 */
export function mcpCallOf(item: Pick<ChatToolItem, 'name' | 'input' | 'output'>, servers: readonly string[]): McpCall | null {
    const input = isRecord(item.input) ? item.input : {};
    const longestFirst = [...servers].sort((left, right) => right.length - left.length);
    const named = namedCall(item.name, input, longestFirst);
    const call = named === undefined ? titledCall(item.name, input, longestFirst) : named;

    return call === null || call === undefined ? null : { ...call, output: unwrapped(item.output) };
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
