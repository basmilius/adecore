import { describe, expect, test } from 'bun:test';
import { cliMcpAllowArgs, cliMcpArgs, cliMcpHeaders, type CliMcpServer } from './cli-mcp.ts';

const SERVER: CliMcpServer = { name: 'own', url: 'http://127.0.0.1:4000/mcp', tokenVariable: 'OWN_TOKEN' };

function jsonAfter(flag: string, args: readonly string[]): unknown {
    expect(args).toHaveLength(1);
    expect(args[0]).toStartWith(`${flag}=`);

    return JSON.parse(args[0]!.slice(flag.length + 1));
}

describe('an MCP server on a CLI command line', () => {
    test('Claude Code gets one `=` config whose header it fills in from the variable', () => {
        expect(jsonAfter('--mcp-config', cliMcpArgs('claude', SERVER))).toEqual({
            mcpServers: { own: { type: 'http', url: SERVER.url, headers: { Authorization: 'Bearer ${OWN_TOKEN}' } } }
        });
    });

    test('Codex names the variable and approves every tool through its config overrides', () => {
        expect(cliMcpArgs('codex', SERVER)).toEqual([
            '-c',
            'mcp_servers.own.url="http://127.0.0.1:4000/mcp"',
            '-c',
            'mcp_servers.own.bearer_token_env_var="OWN_TOKEN"',
            '-c',
            'mcp_servers.own.default_tools_approval_mode="approve"'
        ]);
    });

    test('Copilot gets a literal URL, the header from the variable, and every tool', () => {
        expect(jsonAfter('--additional-mcp-config', cliMcpArgs('copilot', SERVER))).toEqual({
            mcpServers: { own: { type: 'http', url: SERVER.url, headers: { Authorization: 'Bearer ${OWN_TOKEN}' }, tools: ['*'] } }
        });
    });

    test('a CLI without a flag for it gets nothing', () => {
        expect(cliMcpArgs('grok', SERVER)).toEqual([]);
        expect(cliMcpArgs('antigravity', SERVER)).toEqual([]);
        expect(cliMcpArgs('unknown-cli', SERVER)).toEqual([]);
    });

    test('the header names the variable and holds no value', () => {
        expect(cliMcpHeaders('OWN_TOKEN')).toEqual({ Authorization: 'Bearer ${OWN_TOKEN}' });
    });
});

describe('allowing the tools of an MCP server', () => {
    test('is a flag for Claude Code and Copilot, and none for Codex, which allows them in its config', () => {
        expect(cliMcpAllowArgs('claude', 'own')).toEqual(['--allowedTools=mcp__own']);
        expect(cliMcpAllowArgs('copilot', 'own')).toEqual(['--allow-tool=own']);
        expect(cliMcpAllowArgs('codex', 'own')).toEqual([]);
        expect(cliMcpAllowArgs('grok', 'own')).toEqual([]);
    });
});
