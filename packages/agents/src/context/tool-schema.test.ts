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
