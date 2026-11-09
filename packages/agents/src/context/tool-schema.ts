import { z } from 'zod';

/*
 * One field of a tool's input as compact as a model reads it: a type, its choices, a sentence and the
 * fields of an object, without bounds, unions, nulls or `additionalProperties`. A type alias, so a JSON
 * value takes it.
 */
type ToolField = {
    type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: Array<string | number | boolean>;
    items?: ToolField;
    properties?: Record<string, ToolField>;
    required?: string[];
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

function isChoice(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/* The one type of a field, or of all its choices where zod names none; null where it has none, such as `z.unknown()`. */
function typeOf(json: JsonSchema, choices: ReadonlyArray<string | number | boolean>): ToolField['type'] | null {
    const types = (Array.isArray(json.type) ? json.type : [json.type]).filter((type): type is string => typeof type === 'string' && type !== 'null');
    const [type] = types;

    if (type !== undefined && TYPES.has(type)) {
        return type as ToolField['type'];
    }

    const choiceTypes = new Set(choices.map((choice) => typeof choice));
    const [choiceType] = choiceTypes;

    return types.length === 0 && choiceTypes.size === 1 ? (choiceType as 'string' | 'number' | 'boolean') : null;
}

function compact(schema: JsonSchema, withDescription: boolean, path: string): ToolField {
    const json = firstBranch(schema);
    const choices = (Array.isArray(json.enum) ? json.enum : json.const === undefined ? [] : [json.const]).filter(isChoice);
    const type = typeOf(json, choices);

    if (type === null) {
        throw new Error(`${path} takes a value of no one JSON type, which a model cannot be told; give it a type`);
    }

    const field: ToolField = { type };

    if (withDescription && typeof json.description === 'string' && json.description !== '') {
        field.description = json.description;
    }

    if (choices.length > 0) {
        field.enum = choices;
    }

    if (type === 'array' && typeof json.items === 'object' && json.items !== null) {
        field.items = compact(json.items as JsonSchema, false, `${path}[]`);
    }

    if (type === 'object') {
        Object.assign(field, objectFields(json, path));
    }

    return field;
}

/* The fields of an object and the ones it cannot do without; none for an object of any keys, such as a record. */
function objectFields(json: JsonSchema, path: string | null): Pick<ToolField, 'properties' | 'required'> {
    const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
    const required = Array.isArray(json.required) ? json.required.filter((key): key is string => typeof key === 'string') : [];
    const entries = Object.entries(properties).map(([key, property]) => [key, compact(property, true, path === null ? key : `${path}.${key}`)]);

    return {
        ...(entries.length > 0 || path === null ? { properties: Object.fromEntries(entries) } : {}),
        ...(required.length > 0 ? { required } : {})
    };
}

/*
 * The schema an MCP client lists for a tool's input, read off the zod object its call is checked
 * against, as the input side sees it: a field with a default or `.optional()` is not required, and a
 * transform shows the type it starts from. Descriptions come from `.describe()` or `.meta()`. Throws for
 * a field of no one type, such as `z.unknown()` or a mix of literals, since its schema could only lie.
 */
export function toolInputSchema(input: z.ZodObject): ToolInputSchema {
    const json = z.toJSONSchema(input, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
    const { properties = {}, required } = objectFields(json, null);

    return { type: 'object', properties, ...(required === undefined ? {} : { required }) };
}
