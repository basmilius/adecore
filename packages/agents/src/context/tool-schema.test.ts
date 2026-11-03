import { expect, test } from 'bun:test';
import { z } from 'zod';
import { toolInputSchema } from './tool-schema.ts';

test('a field is its type, its choices and its sentence, and nothing more', () => {
    const schema = toolInputSchema(
        z.strictObject({
            id: z.string().min(1).max(40).describe('The node'),
            tail: z.number().int().positive().optional(),
            ratio: z.number().optional(),
            append: z.boolean().optional(),
            layout: z.enum(['grid', 'row']).optional(),
            ids: z.array(z.string().min(1)).max(20),
            color: z.string().nullable().optional().describe('A color, or none')
        })
    );

    expect(schema).toEqual({
        type: 'object',
        properties: {
            id: { type: 'string', description: 'The node' },
            tail: { type: 'integer' },
            ratio: { type: 'number' },
            append: { type: 'boolean' },
            layout: { type: 'string', enum: ['grid', 'row'] },
            ids: { type: 'array', items: { type: 'string' } },
            color: { type: 'string', description: 'A color, or none' }
        },
        required: ['id', 'ids']
    });
});

test('a field with a default or a transform reads as the input it takes', () => {
    const schema = toolInputSchema(
        z.object({
            count: z.number().int().default(1),
            text: z.string().transform((value) => value.trim())
        })
    );

    expect(schema).toEqual({ type: 'object', properties: { count: { type: 'integer' }, text: { type: 'string' } }, required: ['text'] });
});

test('a union is written as its first branch, and an object without fields has no required list', () => {
    expect(toolInputSchema(z.object({ value: z.union([z.string(), z.number()]).optional() }))).toEqual({
        type: 'object',
        properties: { value: { type: 'string' } }
    });
    expect(toolInputSchema(z.object({}))).toEqual({ type: 'object', properties: {} });
});

test('an object keeps its fields and the ones it needs, also inside a list, and a record its type alone', () => {
    const schema = toolInputSchema(
        z.object({
            at: z.object({ x: z.number().describe('Across'), y: z.number().optional() }),
            rows: z.array(z.object({ key: z.enum(['a', 'b']) })).optional(),
            tags: z.record(z.string(), z.string()).optional()
        })
    );

    expect(schema).toEqual({
        type: 'object',
        properties: {
            at: { type: 'object', properties: { x: { type: 'number', description: 'Across' }, y: { type: 'number' } }, required: ['x'] },
            rows: { type: 'array', items: { type: 'object', properties: { key: { type: 'string', enum: ['a', 'b'] } }, required: ['key'] } },
            tags: { type: 'object' }
        },
        required: ['at']
    });
});

test('a choice of numbers or a boolean literal keeps its choices', () => {
    expect(toolInputSchema(z.object({ size: z.literal([1, 2, 3]), on: z.literal(true) })).properties).toEqual({
        size: { type: 'number', enum: [1, 2, 3] },
        on: { type: 'boolean', enum: [true] }
    });
});

test('a field of no one type is refused, since its schema could only lie', () => {
    expect(() => toolInputSchema(z.object({ value: z.unknown() }))).toThrow('value takes a value of no one JSON type');
    expect(() => toolInputSchema(z.object({ at: z.object({ when: z.date() }) }))).toThrow('at.when takes a value of no one JSON type');
    expect(() => toolInputSchema(z.object({ mixed: z.literal(['a', 1]) }))).toThrow('mixed takes');
});
