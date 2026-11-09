import { z } from 'zod';
import { CodedError } from '../coded-error.ts';
import { toolInputSchema } from './tool-schema.ts';

/* A tool said no. The code is for a script, the message for the agent, the lines for what it can pick instead. */
export class ToolRefusal extends CodedError {}

/* What every call carries, whatever else an app puts in it. */
export interface ToolCallBase {
    /* The revision of the document the caller read before it decided on this write. */
    expectedRevision?: number;
}

/* The input field a write takes the revision it was decided on in. */
export const REVISION_FIELD = 'revision';

/* Agents dry-run every call before the real one to be safe, which doubles what each costs them. */
export const DRY_RUN_PREVIEW = 'a refused call makes nothing either, so it is only a preview and never needed for safety';

/* What a client may conclude about a tool before it runs it. */
export interface ToolAnnotations {
    /* Changes nothing at all. */
    readOnly?: boolean;
    /* May remove or overwrite what it cannot give back. */
    destructive?: boolean;
}

export interface ToolSpec<Input extends z.ZodObject, Call extends ToolCallBase, Output> {
    /* Lower snake case, unique across every toolkit of a registry, such as `note_write`. */
    name: string;
    /* What the tool does, in the words a model picks it by. */
    description: string;
    /* Every field the tool takes, each with a sentence of its own for a value it refuses. */
    input: Input;
    annotations?: ToolAnnotations;
    run(input: z.output<Input>, call: Call): Promise<Output>;
}

/* One tool of a toolkit: what a model sees of it, and what runs once its input passed. */
export interface Tool<Call extends ToolCallBase = ToolCallBase, Output = string[], Input extends z.ZodObject = z.ZodObject> {
    readonly name: string;
    readonly toolkit: string;
    readonly description: string;
    readonly input: Input;
    readonly annotations: ToolAnnotations;
    run(input: z.output<Input>, call: Call): Promise<Output>;
}

/* The tools of one area, such as everything about notes. */
export interface Toolkit<Call extends ToolCallBase = ToolCallBase, Output = string[]> {
    readonly name: string;
    readonly tools: readonly Tool<Call, Output>[];
}

interface ToolRegistry<Call extends ToolCallBase = ToolCallBase, Output = string[]> {
    readonly toolkits: readonly Toolkit<Call, Output>[];
    /* Every tool of every toolkit, in the order of the toolkits. */
    readonly tools: readonly Tool<Call, Output>[];
    tool(name: string): Tool<Call, Output> | undefined;
    /* Checks the input against the tool's schema and runs it; refuses `unknown-tool` for a name no toolkit has. */
    run(name: string, input: unknown, call: Call): Promise<Output>;
}

const TOOL_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

export function defineTool<Input extends z.ZodObject, Call extends ToolCallBase, Output>(
    toolkit: string,
    spec: ToolSpec<Input, Call, Output>
): Tool<Call, Output, Input> {
    if (!TOOL_NAME.test(spec.name)) {
        throw new Error(`${spec.name} is no tool name; a tool is named in lower snake case`);
    }

    // An input no MCP schema can describe is a mistake in the code, so it fails here rather than when a client lists the tools.
    try {
        toolInputSchema(spec.input);
    } catch (error) {
        throw new Error(`${spec.name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    return {
        name: spec.name,
        toolkit,
        description: spec.description,
        input: spec.input,
        annotations: spec.annotations ?? {},
        run: spec.run
    };
}

/* Throws when a tool belongs to another toolkit or two tools share a name, which is a mistake in the code and not in a call. */
export function defineToolkit<Call extends ToolCallBase, Output>(name: string, tools: readonly Tool<Call, Output>[]): Toolkit<Call, Output> {
    const names = new Set<string>();

    for (const tool of tools) {
        if (tool.toolkit !== name) {
            throw new Error(`${tool.name} belongs to ${tool.toolkit}, not to ${name}`);
        }

        if (names.has(tool.name)) {
            throw new Error(`${name} has two tools named ${tool.name}`);
        }

        names.add(tool.name);
    }

    return { name, tools };
}

/*
 * A sentence that names its field, so a model knows which one to fix; zod's own messages name none. A
 * message names it when the last key of the issue's path stands in it as a word, as in `note_write needs text`.
 */
function issueMessage(issue: z.core.$ZodIssue): string {
    const path = issue.path.map(String).join('.');
    const field = issue.path.findLast((key) => typeof key === 'string');

    if (path === '' || (field !== undefined && namesWord(issue.message, field))) {
        return issue.message;
    }

    return `${path}: ${issue.message}`;
}

/* Whether `word` stands in `text` on its own, not as a part of a longer name such as `id` in `Invalid`. */
function namesWord(text: string, word: string): boolean {
    const isNamePart = (char: string | undefined): boolean => char !== undefined && /[A-Za-z0-9_]/.test(char);

    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
        if (!isNamePart(text[at - 1]) && !isNamePart(text[at + word.length])) {
            return true;
        }
    }

    return false;
}

/*
 * The input a tool's run gets: an object whose keys are all fields of the tool, a null field counted
 * as left out, checked against the schema. Every way it fails is a `bad-arguments` refusal whose line
 * names the fields the tool takes, since that is what a model fixes its call with.
 */
export function parseToolInput<Input extends z.ZodObject>(tool: { readonly name: string; readonly input: Input }, input: unknown): z.output<Input> {
    const fields = Object.keys(tool.input.shape);
    const lines = [`fields\t${fields.join('\t')}`];

    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new ToolRefusal('bad-arguments', `${tool.name} takes an object of fields`, lines);
    }

    // A key the tool does not have is refused even with a null value, since it is still a field the model got wrong.
    const unknown = Object.keys(input).filter((key) => !fields.includes(key));
    const given = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null && value !== undefined));

    if (unknown.length > 0) {
        throw new ToolRefusal('bad-arguments', `${tool.name} takes no ${unknown.join(', ')}`, lines);
    }

    const parsed = tool.input.safeParse(given);

    if (!parsed.success) {
        const [issue] = parsed.error.issues;

        throw new ToolRefusal('bad-arguments', issue === undefined ? `${tool.name} cannot take this input` : issueMessage(issue), lines);
    }

    return parsed.data;
}

/* Throws when two toolkits share a name or a tool name, so a registry always answers a name with one tool. */
export function createToolRegistry<Call extends ToolCallBase, Output>(toolkits: readonly Toolkit<Call, Output>[]): ToolRegistry<Call, Output> {
    const byName = new Map<string, Tool<Call, Output>>();
    const kits = new Set<string>();

    for (const toolkit of toolkits) {
        if (kits.has(toolkit.name)) {
            throw new Error(`Two toolkits are named ${toolkit.name}`);
        }

        kits.add(toolkit.name);

        for (const tool of toolkit.tools) {
            if (byName.has(tool.name)) {
                throw new Error(`Two tools are named ${tool.name}`);
            }

            byName.set(tool.name, tool);
        }
    }

    return {
        toolkits,
        tools: [...byName.values()],
        tool: (name) => byName.get(name),
        async run(name, input, call) {
            const tool = byName.get(name);

            if (tool === undefined) {
                throw new ToolRefusal('unknown-tool', `${name} is no tool here`, [`tools\t${[...byName.keys()].join('\t')}`]);
            }

            return tool.run(parseToolInput(tool, input), call);
        }
    };
}

/* How much came in, for a refusal that counts: zod hands its error function the input it rejected. */
export function lengthOf(input: unknown): number {
    if (typeof input === 'string' || Array.isArray(input)) {
        return input.length;
    }

    return 0;
}

/* A field a tool cannot do without: the same sentence whether it was left out or left empty, since
   zod's own ("expected string, received undefined") names neither the field nor what goes in it. */
export function requiredField(needs: string): z.ZodString {
    return z.string({ error: needs }).min(1, needs);
}

/* A refusal that promises a list and prints nothing reads as a host that lost it, where there is none. */
export function orNote(lines: string[], note: string): string[] {
    return lines.length === 0 ? [`note\t${note}`] : lines;
}
