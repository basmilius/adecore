import { z } from 'zod';

/*
 * One field of a tool's input as compact as a model reads it: a type, its choices and a sentence,
 * without bounds, unions, nulls or `additionalProperties`. A type alias, so a JSON value takes it.
 */
export type ToolField = {
    type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
    items?: ToolField;
};

/* The input schema an MCP client lists for a tool. */
export type ToolInputSchema = {
    type: 'object';
    properties: Record<string, ToolField>;
    required?: string[];
};

type JsonSchema = Record<string, unknown>;

const TYPES: ReadonlySet<string> = new Set(['string', 'integer', 'number', 'boolean', 'array', 'object']);

/* The branch of a union a model is told about: the first that is not null. */
function firstBranch(json: JsonSchema): JsonSchema {
    const branches = (json.anyOf ?? json.oneOf) as JsonSchema[] | undefined;

    if (branches === undefined) {
        return json;
    }

    const branch = branches.find((candidate) => candidate.type !== 'null') ?? {};

    // The description of a field sits beside its union, not inside a branch.
    return firstBranch({ ...branch, ...(json.description === undefined ? {} : { description: json.description }) });
}

function typeOf(json: JsonSchema): ToolField['type'] {
    const types = (Array.isArray(json.type) ? json.type : [json.type]).filter((type): type is string => typeof type === 'string' && type !== 'null');
    const [type] = types;

    if (type !== undefined && TYPES.has(type)) {
        return type as ToolField['type'];
    }

    // A schema with no type, such as `z.unknown()`, is still written as text.
    return 'string';
}

function compact(schema: JsonSchema, withDescription: boolean): ToolField {
    const json = firstBranch(schema);
    const type = typeOf(json);
    const choices = Array.isArray(json.enum) ? json.enum : typeof json.const === 'string' ? [json.const] : [];
    const strings = choices.filter((choice): choice is string => typeof choice === 'string');
    const field: ToolField = { type };

    if (withDescription && typeof json.description === 'string' && json.description !== '') {
        field.description = json.description;
    }

    if (strings.length > 0) {
        field.enum = strings;
    }

    if (type === 'array' && typeof json.items === 'object' && json.items !== null) {
        field.items = compact(json.items as JsonSchema, false);
    }

    return field;
}

/*
 * The schema an MCP client lists for a tool's input, read off the zod object its call is checked
 * against, as the input side sees it: a field with a default or `.optional()` is not required, and a
 * transform shows the type it starts from. Descriptions come from `.describe()` or `.meta()`.
 */
export function toolInputSchema(input: z.ZodObject): ToolInputSchema {
    const json = z.toJSONSchema(input, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
    const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
    const required = Array.isArray(json.required) ? json.required.filter((key): key is string => typeof key === 'string') : [];

    return {
        type: 'object',
        properties: Object.fromEntries(Object.entries(properties).map(([key, property]) => [key, compact(property, true)])),
        ...(required.length > 0 ? { required } : {})
    };
}
