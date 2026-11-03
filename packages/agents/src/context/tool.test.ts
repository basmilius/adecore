import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { CodedError } from '../coded-error.ts';
import { ToolRefusal, createToolRegistry, defineTool, defineToolkit, parseToolInput, requiredField, type ToolCallBase } from './tool.ts';

interface Call extends ToolCallBase {
    written: string[];
}

const write = defineTool('note', {
    name: 'note_write',
    description: 'Writes a note.',
    input: z.object({
        text: requiredField('note_write needs text'),
        tail: z.number().int().optional()
    }),
    async run(input, call: Call) {
        call.written.push(input.text);

        return [`written\t${input.text}\t${input.tail ?? '-'}`];
    }
});

const notes = defineToolkit('note', [write]);

async function refusalOf(run: () => unknown): Promise<ToolRefusal> {
    try {
        await run();
    } catch (e) {
        if (e instanceof ToolRefusal) {
            return e;
        }

        throw e;
    }

    throw new Error('The call was not refused');
}

describe('defineTool', () => {
    test('a tool keeps its toolkit and gets empty annotations by default', () => {
        expect(write.toolkit).toBe('note');
        expect(write.annotations).toEqual({});
    });

    test('a name that is not lower snake case is a mistake in the code', () => {
        expect(() => defineTool('note', { ...write, name: 'note-write' })).toThrow('lower snake case');
    });
});

describe('defineToolkit', () => {
    test('refuses a tool of another toolkit and two tools of one name', () => {
        expect(() => defineToolkit('link', [write])).toThrow('belongs to note');
        expect(() => defineToolkit('note', [write, write])).toThrow('two tools named note_write');
    });
});

describe('parseToolInput', () => {
    test('a null field counts as left out', () => {
        expect(parseToolInput(write, { text: 'Hi', tail: null })).toEqual({ text: 'Hi' });
    });

    test('a field the tool does not have is refused with the fields it does', async () => {
        const refusal = await refusalOf(() => parseToolInput(write, { text: 'Hi', colour: 'red' }));

        expect(refusal.code).toBe('bad-arguments');
        expect(refusal.message).toBe('note_write takes no colour');
        expect(refusal.lines).toEqual(['fields\ttext\ttail']);
    });

    test("a refusal keeps the schema's own sentence, and names the field where zod's does not", async () => {
        expect((await refusalOf(() => parseToolInput(write, {}))).message).toBe('note_write needs text');
        expect((await refusalOf(() => parseToolInput(write, { text: 'Hi', tail: 1.5 }))).message).toStartWith('tail: ');
    });

    test('input that is no object is refused', async () => {
        expect((await refusalOf(() => parseToolInput(write, ['Hi']))).message).toBe('note_write takes an object of fields');
    });
});

describe('createToolRegistry', () => {
    test('runs a tool by name with its input checked', async () => {
        const call: Call = { written: [] };

        expect(await createToolRegistry([notes]).run('note_write', { text: 'Hi', tail: 3 }, call)).toEqual(['written\tHi\t3']);
        expect(call.written).toEqual(['Hi']);
    });

    test('refuses a name no toolkit has, and nothing runs', async () => {
        const call: Call = { written: [] };
        const refusal = await refusalOf(() => createToolRegistry([notes]).run('note_read', {}, call));

        expect(refusal.code).toBe('unknown-tool');
        expect(refusal.lines).toEqual(['tools\tnote_write']);
        expect(call.written).toEqual([]);
    });

    test('two toolkits that share a tool name are a mistake in the code', () => {
        expect(() => createToolRegistry([notes, defineToolkit('other', [{ ...write, toolkit: 'other' }])])).toThrow('Two tools are named note_write');
    });

    test('a refusal is a coded error, so a host that catches those catches it too', () => {
        expect(new ToolRefusal('code', 'message')).toBeInstanceOf(CodedError);
    });
});
