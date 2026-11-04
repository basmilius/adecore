import type { ChatFileChange, RuntimeMode } from '@adecore/agent-contracts';
import { z } from 'zod';
import { executeApiCommand } from './api-command-tool.ts';
import { executeApiFileTool } from './api-file-tools.ts';

const toolPath = z.string().min(1).max(1024);

function toolCall<Name extends string, Shape extends z.ZodRawShape>(name: Name, fields: Shape) {
    return z.object({ type: z.literal('tool.call'), id: z.string(), name: z.literal(name), ...fields });
}

const ApiToolCallSchema = z.discriminatedUnion('name', [
    toolCall('list_files', { path: toolPath }),
    toolCall('read_file', { path: toolPath, offset: z.number().int().min(0).max(100_000), limit: z.number().int().min(1).max(100).optional() }),
    toolCall('search_files', { path: toolPath, query: z.string().min(1).max(500), glob: z.string().max(200).optional() }),
    toolCall('edit_file', { path: toolPath, oldText: z.string().min(1).max(12000), newText: z.string().max(12000) }),
    toolCall('write_file', { path: toolPath, content: z.string().max(12000) }),
    toolCall('run_command', { command: z.string().min(1).max(4000) }),
    toolCall('ask_user', { question: z.string().min(1).max(1000), options: z.array(z.string().min(1).max(200)).max(6).optional() })
]);
export type ApiToolCall = z.infer<typeof ApiToolCallSchema>;

/** A tool as the model is offered it, before each API puts it in its own shape. */
export interface ApiToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ApiToolResult {
    output: string;
    failed: boolean;
    // Only validation failures before any side effect may let the model correct its input.
    recoverable?: boolean;
    changes?: ChatFileChange[];
}

/** Runs one parsed call in the project folder; a test hands in a fake. */
export type ExecuteApiTool = (cwd: string, call: ApiToolCall, signal: AbortSignal, env: Record<string, string>) => Promise<ApiToolResult>;

// The names the thread shows, the ones a Claude Code chat gives the same tools.
export const API_TOOL_NAMES = {
    list_files: 'ListFiles',
    read_file: 'Read',
    search_files: 'Grep',
    edit_file: 'Edit',
    write_file: 'Write',
    run_command: 'Bash',
    ask_user: 'AskUserQuestion'
} as const satisfies Record<ApiToolCall['name'], string>;

const string = { type: 'string' };

function definition(
    name: ApiToolCall['name'],
    description: string,
    properties: Record<string, unknown>,
    required = Object.keys(properties)
): ApiToolDefinition {
    return { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } };
}

export const API_TOOLS: readonly ApiToolDefinition[] = [
    definition('list_files', 'List a project directory. Paths must be relative, with forward slashes.', { path: string }),
    definition(
        'read_file',
        'Read up to 100 lines of a project file. Offset is zero-based; continue using nextOffset.',
        {
            path: string,
            offset: { type: 'integer', minimum: 0 },
            limit: { type: 'integer', minimum: 1, maximum: 100 }
        },
        ['path', 'offset']
    ),
    definition('search_files', 'Search project files for text.', { path: string, query: string, glob: string }, ['path', 'query']),
    definition('edit_file', 'Replace one exact occurrence of oldText in a project file. Read it first.', { path: string, oldText: string, newText: string }),
    definition('write_file', 'Write a project file, up to 12000 characters.', { path: string, content: string }),
    definition('run_command', 'Run a shell command in the project. Windows uses PowerShell; macOS/Linux use sh.', { command: string }),
    definition(
        'ask_user',
        'Ask the person a question and wait for the answer. Use it whenever you need a decision, a preference or a fact you cannot find in the project, instead of writing the question in your reply. Give options when the answer is a choice.',
        { question: string, options: { type: 'array', items: string, maxItems: 6 } },
        ['question']
    )
];

/*
 * The mode a chat on a plain API works in. `auto` is a CLI's own classifier deciding what is safe, which a
 * plain API lacks, so it takes the narrower mode that has a rule here instead of guessing. Reads and edits go
 * through, and a command still asks.
 */
export function apiEffectiveMode(mode: RuntimeMode): RuntimeMode {
    return mode === 'auto' ? 'auto-accept-edits' : mode;
}

const READ_TOOLS: ReadonlySet<string> = new Set(['list_files', 'read_file', 'search_files']);
const EDIT_TOOLS: ReadonlySet<string> = new Set(['edit_file', 'write_file']);

/* Whether a tool waits for a person: everything in `supervised`, only commands once edits are accepted, nothing in `full-access`. */
export function apiNeedsApproval(mode: RuntimeMode, tool: string): boolean {
    const effective = apiEffectiveMode(mode);

    if (effective === 'full-access') {
        return false;
    }

    if (effective === 'auto-accept-edits') {
        return !READ_TOOLS.has(tool) && !EDIT_TOOLS.has(tool);
    }

    return true;
}

export function apiToolCall(id: string, name: string, argumentsJson: string): ApiToolCall {
    if (!API_TOOLS.some((entry) => entry.name === name)) {
        throw new Error('Unsupported tool requested.');
    }

    const input: unknown = JSON.parse(argumentsJson);

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid tool arguments.');
    }

    return ApiToolCallSchema.parse({ ...input, type: 'tool.call', id, name });
}

export function apiToolInput(call: ApiToolCall): Record<string, unknown> {
    const { type: _type, id: _id, name: _name, ...input } = call;

    switch (call.name) {
        case 'read_file':
            return { file_path: call.path, offset: call.offset, ...(call.limit === undefined ? {} : { limit: call.limit }) };
        case 'edit_file':
            return { file_path: call.path, old_string: call.oldText, new_string: call.newText };
        case 'write_file':
            return { file_path: call.path, content: call.content };
        case 'search_files':
            return { path: call.path, pattern: call.query, ...(call.glob === undefined ? {} : { glob: call.glob }) };
        default:
            return input;
    }
}

/* The card an `ask_user` call puts in the thread, one question with its options as choices. */
export function askUserCard(id: string, call: Extract<ApiToolCall, { name: 'ask_user' }>) {
    return {
        type: 'question.requested' as const,
        requestId: id,
        questions: [
            { id, header: 'Question', question: call.question, choices: (call.options ?? []).map((label) => ({ label, description: '' })), multiSelect: false }
        ]
    };
}

export async function executeApiTool(cwd: string, call: ApiToolCall, signal?: AbortSignal, env?: Record<string, string>): Promise<ApiToolResult> {
    try {
        signal?.throwIfAborted();

        let result: ApiToolResult;

        switch (call.name) {
            case 'list_files':
            case 'read_file':
            case 'search_files':
            case 'edit_file':
            case 'write_file':
                result = await executeApiFileTool(cwd, call, signal);
                break;
            case 'run_command':
                result = await executeApiCommand(cwd, call.command, signal, env);
                break;
            case 'ask_user':
                throw new Error('Questions must be answered through the chat question card.');
        }

        signal?.throwIfAborted();

        return result;
    } catch (error) {
        signal?.throwIfAborted();

        const message = error instanceof Error && !('code' in error) ? error.message : 'The requested local tool could not complete.';

        return { output: `Tool failed: ${message}`, failed: true };
    }
}
