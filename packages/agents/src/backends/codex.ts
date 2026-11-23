import type { ModelSelection, ProviderCapabilities, RuntimeMode } from '@adecore/agent-contracts';
import { isRecord } from '@adecore/utils/record';

// The app-server speaks JSON-RPC on stdio; the session adds nothing to the command line.
export const CODEX_CHAT_ARGS = ['app-server'];

/* Which kinds of request Codex sends the host; a kind left off it decides itself, as `never` does for all of them. */
interface CodexGranularPolicy {
    granular: {
        mcp_elicitations: boolean;
        rules: boolean;
        sandbox_approval: boolean;
        skill_approval: boolean;
        request_permissions: boolean;
    };
}

type CodexApprovalPolicy = 'untrusted' | 'on-request' | 'never' | CodexGranularPolicy;
type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

interface CodexThreadOptions {
    approvalPolicy: CodexApprovalPolicy;
    sandbox: CodexSandboxMode;
}

/*
 * Full access with only MCP elicitations on. Under `never` Codex declines an elicitation before the host sees it, and an
 * MCP server may keep that decline as the person's (a browser plugin saves it as a site denial for the thread). Codex
 * still asks before a command its own danger check flags; the backend accepts that one itself.
 */
const FULL_ACCESS_GRANULAR: CodexGranularPolicy = {
    granular: { mcp_elicitations: true, rules: false, sandbox_approval: false, skill_approval: false, request_permissions: false }
};

/*
 * Whether a Codex of this `--version` is 0.166.0 or newer, the version whose config and app-server schema the newer
 * keys were read from; no older one was checked, so an older one may refuse them. An unknown version, or a
 * prerelease of 0.166.0, is not.
 */
export function codexFrom0166(version: string | null): boolean {
    const match = version === null ? null : /^v?(\d+)\.(\d+)\.(\d+)(-)?/.exec(version.trim());

    if (match === null) {
        return false;
    }

    const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];

    if (major > 0 || minor > 166) {
        return true;
    }

    return minor === 166 && (patch > 0 || match[4] === undefined);
}

/*
 * Codex has two knobs, when it asks and where it may write, and no "ask for commands but not for
 * edits" policy. `untrusted` inside a writable workspace comes closest: edits within the workspace
 * pass the sandbox without a prompt, commands still ask unless Codex knows them as safe.
 * `on-request` with the same sandbox is Codex's own default and stands in for `auto`.
 */
const THREAD_OPTIONS: Record<RuntimeMode, CodexThreadOptions> = {
    supervised: { approvalPolicy: 'untrusted', sandbox: 'read-only' },
    'auto-accept-edits': { approvalPolicy: 'untrusted', sandbox: 'workspace-write' },
    auto: { approvalPolicy: 'on-request', sandbox: 'workspace-write' },
    'full-access': { approvalPolicy: 'never', sandbox: 'danger-full-access' }
};

/* `version` is what the installed Codex's `--version` said, null while unknown; full access widens to the granular policy only on a known one. */
export function codexThreadOptions(runtimeMode: RuntimeMode, version: string | null = null): CodexThreadOptions {
    if (runtimeMode === 'full-access' && codexFrom0166(version)) {
        return { approvalPolicy: FULL_ACCESS_GRANULAR, sandbox: 'danger-full-access' };
    }

    return THREAD_OPTIONS[runtimeMode];
}

/* True for the granular policy full access sends: elicitations on, every other kind off. */
export function isFullAccessGranular(approvalPolicy: unknown): boolean {
    const flags = isRecord(approvalPolicy) && isRecord(approvalPolicy.granular) ? approvalPolicy.granular : null;

    return flags?.mcp_elicitations === true && Object.keys(flags).every((key) => key === 'mcp_elicitations' || flags[key] !== true);
}

/* What a thread's approval policy reads as in a permission mode line. */
export function codexPolicyName(approvalPolicy: unknown): string | null {
    if (typeof approvalPolicy === 'string') {
        return approvalPolicy;
    }

    return isRecord(approvalPolicy) && isRecord(approvalPolicy.granular) ? 'granular' : null;
}

export function codexRuntimeMode(approvalPolicy: unknown, sandbox: string): RuntimeMode | undefined {
    const names: Record<string, string> = { readOnly: 'read-only', workspaceWrite: 'workspace-write', dangerFullAccess: 'danger-full-access' };
    const sandboxMode = names[sandbox] ?? sandbox;

    if (isFullAccessGranular(approvalPolicy)) {
        return sandboxMode === 'danger-full-access' ? 'full-access' : undefined;
    }

    return (Object.keys(THREAD_OPTIONS) as RuntimeMode[]).find((mode) => {
        const options = THREAD_OPTIONS[mode];

        return options.approvalPolicy === approvalPolicy && options.sandbox === sandboxMode;
    });
}

// What the app-server calls the faster of the two tiers it lists per model; the standard tier is no id at all.
const CODEX_PRIORITY_TIER = 'priority';

export function codexServiceTier(selection: ModelSelection): string | null {
    return selection.options.serviceTier === true ? CODEX_PRIORITY_TIER : null;
}

export const CODEX_CAPABILITIES: ProviderCapabilities = {
    chat: true,
    terminal: true,
    hooks: true,
    streamsToolOutput: true,
    diffs: 'unified',
    attachments: true,
    // Codex has no mention part in its protocol; the picker sends the path as text, which is all
    // the model needs to open the file with its own tools.
    mentions: true,
    denyReason: false,
    allowAlways: true,
    asyncQuestions: true,
    steer: true,
    compaction: 'native',
    reportsCost: false,
    reportsContextWindow: true,
    reportsThinking: true,
    slashCommands: false,
    goals: 'native',
    fork: true
};

// `codex resume` is a subcommand that reads `[OPTIONS] [SESSION_ID]`, so the flags go after it.
export const CODEX_RESUME_COMMAND = 'codex resume {flags} {id}';
