import { describe, expect, test } from 'bun:test';
import type { ChatToolItem } from '@adecore/agent-contracts';
import type { ToolLook } from '../../host';
import { lookRunOf, sentMessageOf } from './command-looks';
import { matchToolLook, mcpCallOf } from './tool-looks';

function tool(name: string, input: unknown, output: string | null = null, state: ChatToolItem['state'] = 'done'): ChatToolItem {
    return { id: 'x', kind: 'tool', createdAt: 1, turnId: null, toolUseId: 'x', name, input, output, state, parentToolUseId: null };
}

/* An invented server `orbit` with the tools `probe_send`, `probe_list` and `say`. */
const ORBIT: ToolLook = {
    server: 'orbit',
    brand: 'Orbit',
    Mark: () => null,
    describe: (name) => {
        if (name === 'say') {
            return { label: 'Message' };
        }

        return name.startsWith('probe_')
            ? { label: 'Probe', lead: name.slice(6), group: { key: 'probe', sentence: (count) => `Used Orbit probe ${count} times` } }
            : null;
    },
    sent: ({ tool: name, input, state, output }) =>
        name === 'say' && typeof input.to === 'string' && typeof input.text === 'string'
            ? { to: input.to, text: input.text, state: state === 'running' ? 'sending' : output === 'heard' ? 'delivered' : 'failed' }
            : null
};

const LOOKS = [ORBIT];

describe('mcpCallOf', () => {
    test.each([
        ['an MCP tool name', tool('mcp__orbit__probe_send', { target: 'moon' })],
        ['a server and a tool with a slash', tool('orbit/probe_send', { target: 'moon' })],
        [
            'a use_tool call',
            tool('Tool', { description: 'orbit__probe_send', variant: 'UseTool', tool_name: 'orbit__probe_send', tool_input: { target: 'moon' } })
        ],
        [
            'a call titled with one underscore and its arguments apart',
            tool('Tool', { description: 'orbit_probe_send', arguments: { target: 'moon' }, target: 'moon' })
        ],
        ['a call titled with a hyphen and its arguments beside the title', tool('Read', { description: 'orbit-probe_send', target: 'moon' })]
    ])('reads %s', (_shape, item) => {
        expect(mcpCallOf(item, ['orbit'])).toEqual({ server: 'orbit', tool: 'probe_send', input: { target: 'moon' }, output: null });
    });

    test('reads the tool name of a use_tool call before its title is known', () => {
        expect(mcpCallOf(tool('Tool', { description: 'use_tool', tool_name: 'orbit__say', tool_input: {} }), ['orbit'])?.tool).toBe('say');
    });

    test('reads a name that says the server before any title, over every server, the longest name first', () => {
        const titled = { description: 'orbit-probe_send' };
        expect(mcpCallOf(tool('other/read', titled), ['orbit', 'other'])).toMatchObject({ server: 'other', tool: 'read' });
        expect(mcpCallOf(tool('mcp__orbit__deep__scan', {}), ['orbit', 'orbit__deep'])).toMatchObject({ server: 'orbit__deep', tool: 'scan' });
        expect(mcpCallOf(tool('Tool', { tool_name: 'orbit__deep__scan', tool_input: {} }), ['orbit', 'orbit__deep'])?.server).toBe('orbit__deep');
    });

    test.each([
        ['an MCP tool name of another server', tool('mcp__foreign__write', { description: 'orbit-probe_send' })],
        ['a server and a tool with a slash of another server', tool('foreign/write', { description: 'orbit-probe_send' })],
        ['a use_tool call of another server', tool('Tool', { description: 'orbit__probe_send', tool_name: 'foreign__write', tool_input: {} })],
        ['a read of a file', tool('Read', { file_path: '/tmp/orbit-probe_send', description: 'orbit-probe_send' })],
        ['a call of a tool the thread knows', tool('Grep', { pattern: 'x', description: 'orbit-probe_send' })]
    ])('lets %s rule out a title that names the server', (_shape, item) => {
        expect(mcpCallOf(item, ['orbit'])).toBeNull();
    });

    test('takes the answer out of the envelope a CLI puts around it, and leaves any other answer as it is', () => {
        const wrapped = '{"type":"MCP","tool_name":"probe_send","server_name":"orbit","output":{"OkayOutput":"sent\\tmoon"}}';
        const reordered = ' \n{"output":{"OkayOutput":"sent"},"server_name":"orbit","type":"MCP"}';
        const other = '{"type":"other","output":{"OkayOutput":"sent"}}';
        expect(mcpCallOf(tool('mcp__orbit__probe_send', {}, reordered), ['orbit'])?.output).toBe('sent');
        expect(mcpCallOf(tool('mcp__orbit__probe_send', {}, other), ['orbit'])?.output).toBe(other);
        expect(mcpCallOf(tool('mcp__orbit__probe_send', {}, wrapped), ['orbit'])?.output).toBe('sent\tmoon');
        expect(mcpCallOf(tool('mcp__orbit__probe_send', {}, '{"type":"MCP"'), ['orbit'])?.output).toBe('{"type":"MCP"');
        expect(mcpCallOf(tool('mcp__orbit__probe_send', {}, 'sent'), ['orbit'])?.output).toBe('sent');
    });

    test.each([
        ['another server', tool('mcp__other__probe_send', {})],
        ['a server whose name only starts the same', tool('mcp__orbital__probe_send', {})],
        ['a shell call titled like one', tool('Bash', { command: 'ls', description: 'orbit-probe_send' })],
        ['a title with words after the server', tool('Tool', { description: 'orbit probe send' })],
        ['a call with no title', tool('Tool', {})]
    ])('leaves %s alone', (_shape, item) => {
        expect(mcpCallOf(item, ['orbit'])).toBeNull();
    });
});

describe('matchToolLook', () => {
    test('draws the lead and the input as fields, each value a word, long and spaced ones shortened and quoted', () => {
        const run = matchToolLook(
            tool('mcp__orbit__probe_send', { target: 'moon-1', note: 'x'.repeat(50), crew: ['ann', 'bo'], when: 3, about: { deep: true } }),
            LOOKS
        )!;
        expect(run.label).toBe('Probe');
        expect(run.detail).toBe(`send target=moon-1 note=${'x'.repeat(40)}… crew=ann,bo when=3 about={…}`);
        expect(run.words.map(({ text, option }) => [text, option])).toEqual([
            ['moon-1', 'target'],
            ['x'.repeat(50), 'note'],
            ['ann', 'crew'],
            ['bo', 'crew'],
            ['3', 'when']
        ]);
        expect(run.detail.slice(run.words[0]!.start, run.words[0]!.end)).toBe('moon-1');
        expect(run.shell).toBe(false);
    });

    test('quotes a value with spaces and keeps the fields a match names, in its order', () => {
        const fields: ToolLook = { ...ORBIT, describe: () => ({ label: 'Probe', fields: ['note', 'target'] }) };
        const run = matchToolLook(tool('mcp__orbit__probe_send', { target: 'moon', note: 'look\nup', extra: 'no' }), [fields])!;
        expect(run.detail).toBe('note="look up" target=moon');
        expect(run.detail.slice(run.words[0]!.start, run.words[0]!.end)).toBe('look up');
    });

    test('leaves a tool the look does not describe, and a call without looks, as the CLI named it', () => {
        expect(matchToolLook(tool('mcp__orbit__teleport', {}), LOOKS)).toBeNull();
        expect(matchToolLook(tool('mcp__orbit__probe_send', {}), undefined)).toBeNull();
    });

    test('a shell call goes to the look of its program first', () => {
        const item = tool('Bash', { command: 'ls', description: 'orbit-probe_send' });
        expect(lookRunOf(item, [], LOOKS)).toBeNull();
        expect(lookRunOf(tool('orbit/probe_list', {}), [], LOOKS)?.detail).toBe('list');
    });
});

describe('a message sent with a tool of a look', () => {
    test('is read from the input and the answer, out of its envelope', () => {
        const wrapped = '{"type":"MCP","output":{"OkayOutput":"heard"}}';
        const say = tool('Tool', { description: 'orbit__say', tool_name: 'orbit__say', tool_input: { to: 'chat-b', text: 'on it' } }, wrapped);
        expect(sentMessageOf(say, [], LOOKS)).toEqual({ to: 'chat-b', text: 'on it', state: 'delivered' });
        expect(sentMessageOf({ ...say, state: 'running', output: null }, [], LOOKS)?.state).toBe('sending');
        expect(sentMessageOf(say, [])).toBeNull();
    });
});
