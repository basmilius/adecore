import { describe, expect, test } from 'bun:test';
import { AGENT_KIND_MAX_LENGTH, AgentInfoSchema, AgentKindSchema, isKnownAgentKind, KNOWN_AGENT_KINDS } from './agent.ts';

describe('agent kind', () => {
    test('every kind this version knows parses', () => {
        for (const kind of KNOWN_AGENT_KINDS) {
            expect(AgentKindSchema.parse(kind)).toBe(kind);
        }
    });

    test('a kind a newer host adds parses, so a reply that names it still reads', () => {
        expect(AgentKindSchema.parse('grok')).toBe('grok');
        expect(AgentKindSchema.parse('nano-gpt2')).toBe('nano-gpt2');
        const info = AgentInfoSchema.parse({ kind: 'antigravity', agentSessionId: 's1', transcriptPath: null, status: 'idle', live: true, updatedAt: 0 });
        expect(info.kind).toBe('antigravity');
        expect(isKnownAgentKind(info.kind)).toBe(false);
        expect(isKnownAgentKind('claude')).toBe(true);
    });

    test('a kind is an identifier and never a path, a command or a sentence', () => {
        for (const kind of [
            '',
            'Claude',
            '2claude',
            '-claude',
            'claude code',
            '../claude',
            'claude;rm',
            'claude_code',
            'a'.repeat(AGENT_KIND_MAX_LENGTH + 1)
        ]) {
            expect(AgentKindSchema.safeParse(kind).success).toBe(false);
        }

        expect(AgentKindSchema.safeParse('a'.repeat(AGENT_KIND_MAX_LENGTH)).success).toBe(true);
        expect(AgentKindSchema.safeParse(42).success).toBe(false);
    });
});
