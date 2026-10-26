import type { AgentKind } from '@adecore/agent-contracts';
import clsx from 'clsx';
import { Bot } from 'lucide-react';
import { siClaude, siGithubcopilot, siGooglegemini } from 'simple-icons';
import { Icon } from '@adecore/ui';
import { type AgentMark, hostAgentMark } from './agent-marks';
import { PROVIDER_PATHS } from './provider-paths';

// simple-icons removed OpenAI's mark at its request, so Codex reuses the usage page's path.
const BUILT_IN_MARKS: Partial<Record<AgentKind, AgentMark>> = {
    claude: siClaude,
    codex: { title: 'Codex', path: PROVIDER_PATHS.codex },
    grok: { title: 'Grok', path: PROVIDER_PATHS.grok },
    gemini: siGooglegemini,
    copilot: siGithubcopilot
};

export function AgentIcon({ kind, size = 14, className }: { kind: AgentKind; size?: number; className?: string }) {
    const mark = hostAgentMark(kind) ?? BUILT_IN_MARKS[kind];

    if (!mark) {
        return <Icon icon={Bot} size={size} className={className} />;
    }

    return (
        <svg
            role="img"
            aria-label={mark.title}
            viewBox={mark.viewBox ?? '0 0 24 24'}
            width={size}
            height={size}
            fill="currentColor"
            className={clsx('align-middle', className)}
        >
            <path d={mark.path} />
        </svg>
    );
}
