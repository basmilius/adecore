import { describe, expect, test } from 'bun:test';
import { claudeProvider } from '../providers/claude-provider.ts';
import { fakeClaude } from '../testing/fake-claude.ts';
import { inProcess, type FakeCli, type InProcessCli } from '../testing/fake-cli.ts';
import type { BackendEvent, BackendLaunch, ChatBackend, TurnInput } from './backend.ts';
import type { ChatProcess, ChatSpawnOptions } from './chat-process.ts';
import { ClaudeBackend } from './claude-backend.ts';
import { ClaudeSdkBackend } from './claude-sdk-backend.ts';
import autoFallbackCapture from './fixtures/claude-2.1.285-auto-fallback.json';
import nativeChildrenCapture from './fixtures/claude-2.1.285-native-children.json';
import compactCapture from './fixtures/claude-2.1.285-resume-direct-compact.json';
import resumedTaskCapture from './fixtures/claude-2.1.285-resume-task-notification.json';
import goalCapture from './fixtures/claude-2.1.296-goal.json';

const launch: BackendLaunch = {
    command: ['claude'],
    cwd: '/tmp',
    env: {},
    selection: claudeProvider.catalog.normalize(undefined),
    modelName: 'Claude',
    runtimeMode: 'supervised',
    resume: null,
    generation: 1,
    now: () => 1_000,
    instructions: null,
    resumeNote: null
};

function turn(text: string, promptId?: string): TurnInput {
    return { text, preamble: null, attachments: [], mentions: [], skills: [], ...(promptId ? { promptId } : {}) };
}

async function flush(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
}

/* Settles once `check` holds; the SDK hands a frame on a few event-loop turns later than our own reader does. */
async function until(check: () => boolean): Promise<void> {
    for (let i = 0; i < 5_000 && !check(); i++) {
        await flush();
    }

    expect(check()).toBe(true);
}

/* Settles once no event arrived for a while, counted in event-loop turns. */
async function quiet(events: readonly unknown[]): Promise<void> {
    let seen = -1;
    let still = 0;

    for (let i = 0; i < 5_000 && still < 50; i++) {
        still = events.length === seen ? still + 1 : 0;
        seen = events.length;
        await flush();
    }
}

// Every fake process names its messages and its session at random, and a compact gets a prompt id of its own.
function stable(events: readonly BackendEvent[]): unknown {
    return JSON.parse(
        JSON.stringify(events)
            .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'uuid')
            .replaceAll(/msg_[a-z0-9]{1,4}_/g, 'msg_')
            .replaceAll(/fake-[a-z0-9]{1,6}/g, 'fake-session')
            .replaceAll(/"startedAt":\d+/g, '"startedAt":0')
    );
}

type Kind = 'stream-json' | 'agent-sdk';

interface Run {
    backend: ChatBackend;
    events: BackendEvent[];
    cli: InProcessCli;
}

function open(kind: Kind, cli: FakeCli = fakeClaude, overrides: Partial<BackendLaunch> = {}): Run {
    const fake = inProcess(cli);
    const events: BackendEvent[] = [];
    const host = { onEvent: (event: BackendEvent) => events.push(event) };
    const made = { ...launch, spawn: fake.spawn, ...overrides };
    const backend = kind === 'agent-sdk' ? new ClaudeSdkBackend(made, host) : new ClaudeBackend(made, host);

    return { backend, events, cli: fake };
}

const doneTurns = (events: readonly BackendEvent[]): number => events.filter((event) => event.type === 'turn.done').length;

function requestOf(events: readonly BackendEvent[], type: 'approval.requested' | 'question.requested'): string {
    const request = events.findLast((event) => event.type === type);

    if (request === undefined || !('requestId' in request)) {
        throw new Error(`No ${type}`);
    }

    return request.requestId;
}

/* What a person does in one chat, the same on either backend. */
const SCENARIOS: Record<string, (run: Run) => Promise<void>> = {
    'a plain turn': async ({ backend, events }) => {
        backend.sendTurn(turn('hello', 'p1'));
        await until(() => doneTurns(events) === 1);
    },
    'an approval allowed': async ({ backend, events }) => {
        backend.sendTurn(turn('tool: ls', 'p1'));
        await until(() => events.some((event) => event.type === 'approval.requested'));
        expect(backend.respondApproval(requestOf(events, 'approval.requested'), 'allow')).toBe(true);
        await until(() => doneTurns(events) === 1);
    },
    'an approval allowed always': async ({ backend, events }) => {
        backend.sendTurn(turn('tool: ls', 'p1'));
        await until(() => events.some((event) => event.type === 'approval.requested'));
        expect(backend.respondApproval(requestOf(events, 'approval.requested'), 'allow-always')).toBe(true);
        await until(() => doneTurns(events) === 1);
    },
    'an approval denied with a reason': async ({ backend, events }) => {
        backend.sendTurn(turn('tool: rm -rf build', 'p1'));
        await until(() => events.some((event) => event.type === 'approval.requested'));
        const requestId = requestOf(events, 'approval.requested');
        expect(backend.respondApproval(requestId, 'deny', 'not now')).toBe(true);
        expect(backend.respondApproval(requestId, 'deny', 'twice')).toBe(false);
        await until(() => doneTurns(events) === 1);
    },
    'a question answered': async ({ backend, events }) => {
        backend.sendTurn(turn('ask: Which color?', 'p1'));
        await until(() => events.some((event) => event.type === 'question.requested'));
        const question = events.find((event) => event.type === 'question.requested');
        const questionId = question?.type === 'question.requested' ? question.questions[0]!.id : '';
        expect(backend.respondQuestion(requestOf(events, 'question.requested'), { [questionId]: 'Red' })).toBe(true);
        await until(() => doneTurns(events) === 1);
    },
    'a stop, then a background request declined': async ({ backend, events }) => {
        backend.sendTurn(turn('background approval: ls\nslow', 'p1'));
        await until(() => events.some((event) => event.type === 'approval.requested'));
        backend.interrupt();
        await until(() => doneTurns(events) === 1);
        expect(backend.declineRequest?.(requestOf(events, 'approval.requested'), 'The person stopped the turn')).toBe(true);
        await quiet(events);
    },
    'one subagent stopped beside another': async ({ backend, events, cli }) => {
        backend.sendTurn(turn('two subagents', 'p1'));
        await until(() => events.filter((event) => event.type === 'task.started').length === 2);
        backend.stopTask?.('a-one');
        await until(() => events.some((event) => event.type === 'task.done'));
        cli.started[0]!.runLater();
        await until(() => doneTurns(events) === 1);
    },
    'a compact': async ({ backend, events }) => {
        backend.compact();
        await until(() => doneTurns(events) === 1);
    },
    'a crash': async ({ backend, events }) => {
        backend.sendTurn(turn('crash', 'p1'));
        await until(() => events.some((event) => event.type === 'exit'));
        expect(backend.running).toBe(false);
        expect(() => backend.sendTurn(turn('after'))).toThrow('Claude stdin is closed');
    },
    'a crash that says why on stderr': async ({ backend, events }) => {
        backend.sendTurn(turn('crash loudly', 'p1'));
        await until(() => events.some((event) => event.type === 'exit'));
    }
};

// Prompts the fake answers on its own, with work it puts off until the test says so.
for (const prompt of [
    'delegate: research',
    'delegate late: research',
    'nested: done',
    'background: done',
    'background command: sleep 30',
    'workflow:',
    'run: ls'
]) {
    SCENARIOS[`the prompt "${prompt}"`] = async ({ backend, events, cli }) => {
        backend.sendTurn(turn(prompt, 'p1'));
        await until(() => doneTurns(events) >= 1);
        cli.started[0]!.runLater();
        await quiet(events);
    };
}

async function play(kind: Kind, scenario: (run: Run) => Promise<void>): Promise<BackendEvent[]> {
    const run = open(kind);
    await run.backend.start();
    await scenario(run);
    await quiet(run.events);
    await run.backend.dispose();

    return run.events;
}

describe('the Agent SDK backend tells the session what the stream-json one does', () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
        test(name, async () => {
            const reference = await play('stream-json', scenario);
            const events = await play('agent-sdk', scenario);
            expect(reference.some((event) => event.type === 'turn.done' || event.type === 'exit')).toBe(true);
            expect(stable(events)).toEqual(stable(reference));
        });
    }
});

/* A CLI that writes a captured run as soon as the first message arrives, and answers the handshake first. */
function replaying(frames: readonly unknown[]): FakeCli {
    return (io) => {
        let replayed = false;

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as { type?: string; request_id?: string; request?: { subtype?: string } };

                if (frame.type === 'control_request') {
                    const body =
                        frame.request?.subtype === 'initialize'
                            ? { commands: [], agents: [], output_style: 'default', available_output_styles: [], models: [], account: {} }
                            : {};
                    io.out({ type: 'control_response', response: { subtype: 'success', request_id: frame.request_id, response: body } });
                } else if (frame.type === 'user' && !replayed) {
                    replayed = true;

                    for (const captured of frames) {
                        io.out(captured);
                    }
                }
            }
        };
    };
}

describe('a captured run reads the same through the Agent SDK', () => {
    const captures: Record<string, { frames: readonly unknown[] }> = {
        'claude-2.1.285-auto-fallback': autoFallbackCapture,
        'claude-2.1.285-native-children': nativeChildrenCapture,
        'claude-2.1.285-resume-direct-compact': compactCapture,
        'claude-2.1.285-resume-task-notification': resumedTaskCapture,
        'claude-2.1.296-goal': goalCapture
    };

    for (const [name, capture] of Object.entries(captures)) {
        test(name, async () => {
            const played: BackendEvent[][] = [];

            for (const kind of ['stream-json', 'agent-sdk'] as const) {
                const run = open(kind, replaying(capture.frames));
                await run.backend.start();
                run.backend.sendTurn(turn('go', 'captured-prompt'));
                await until(() => played.length === 0 || run.events.length >= played[0]!.length);
                await quiet(run.events);
                await run.backend.dispose();
                played.push(run.events);
            }

            expect(played[0]!.length).toBeGreaterThan(0);
            expect(played[1]).toEqual(played[0]!);
        });
    }
});

/* The spawn of a fake that also keeps what the SDK put in the environment. */
function recording(cli: FakeCli = fakeClaude) {
    const fake = inProcess(cli);
    const spawned: ChatSpawnOptions[] = [];

    return {
        fake,
        spawned,
        spawn: (options: ChatSpawnOptions): ChatProcess => {
            spawned.push(options);

            return fake.spawn(options);
        }
    };
}

describe('the Agent SDK backend', () => {
    test("starts the person's own CLI with the launch command's arguments first, and maps the selection and the modes onto the SDK", async () => {
        const cli = recording();
        const events: BackendEvent[] = [];

        const backend = new ClaudeSdkBackend(
            {
                ...launch,
                command: ['/opt/claude/bin/claude', '--debug-to-stderr'],
                selection: { model: 'claude-opus-5', options: { effort: 'xhigh', contextWindow: '1m', fastMode: true } },
                runtimeMode: 'full-access',
                resume: 'session-1',
                folders: ['/brand/kit'],
                projectConfig: false,
                spawn: cli.spawn,
                mcpServers: [
                    { name: 'context', url: 'http://127.0.0.1:4210/mcp', headers: { Authorization: 'Bearer ${CONTEXT_TOKEN}' }, allowTools: true },
                    { name: 'old', url: 'http://127.0.0.1:4211/sse', transport: 'sse' }
                ]
            },
            { onEvent: (event) => events.push(event) },
            { allowedTools: ['Bash(git status)'] }
        );

        await backend.start();
        const [spawned] = cli.spawned;
        const argv = cli.fake.started[0]!.argv;
        expect(spawned!.command.slice(0, 2)).toEqual(['/opt/claude/bin/claude', '--debug-to-stderr']);
        expect(argv).toEqual(
            expect.arrayContaining([
                '--model=claude-opus-5[1m]',
                '--effort=xhigh',
                '--permission-mode=bypassPermissions',
                '--allow-dangerously-skip-permissions',
                '--resume=session-1',
                '--allowedTools=Bash(git status),mcp__context__*',
                '--add-dir=/brand/kit',
                '--setting-sources=user',
                '--strict-mcp-config',
                '--include-partial-messages',
                '--replay-user-messages',
                '--permission-prompt-tool=stdio'
            ])
        );
        expect(argv[argv.indexOf('--settings') + 1]).toBe('{"fastMode":true}');
        // The header goes to the CLI as written, which expands the variable itself.
        expect(JSON.parse(argv[argv.indexOf('--mcp-config') + 1]!)).toEqual({
            mcpServers: {
                context: { type: 'http', url: 'http://127.0.0.1:4210/mcp', headers: { Authorization: 'Bearer ${CONTEXT_TOKEN}' } },
                old: { type: 'sse', url: 'http://127.0.0.1:4211/sse' }
            }
        });
        expect(argv).not.toContain('-p');
        expect(spawned!.env.CLAUDE_CODE_ENTRYPOINT).toBe('sdk-ts');
        await backend.dispose();
    });

    test('hands the CLI its system prompt in the handshake, not on the command line', async () => {
        const run = open('agent-sdk', fakeClaude, { instructions: 'You work in the motion editor.' });
        await run.backend.start();
        run.backend.sendTurn(turn('system?', 'p1'));
        await until(() => doneTurns(run.events) === 1);
        expect(run.events).toContainEqual(expect.objectContaining({ type: 'text.done', text: 'You work in the motion editor.' }));
        expect(run.cli.started[0]!.argv.some((arg) => arg.includes('system-prompt'))).toBe(false);
        await run.backend.dispose();
    });

    test('a 200k pick caps the compact window in the environment it starts the CLI in', async () => {
        const cli = recording();
        const backend = new ClaudeSdkBackend(
            { ...launch, selection: { model: 'claude-sonnet-5', options: { contextWindow: '200k' } }, spawn: cli.spawn },
            { onEvent: () => undefined }
        );

        await backend.start();
        expect(cli.spawned[0]!.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('200000');
        expect(cli.fake.started[0]!.argv[cli.fake.started[0]!.argv.indexOf('--settings') + 1]).toBe('{"autoCompactEnabled":true}');
        await backend.dispose();
    });

    test('acknowledges a steer once the CLI replays it', async () => {
        const run = open('agent-sdk');
        await run.backend.start();
        run.backend.sendTurn(turn('slow', 'original'));
        await until(() => run.events.some((event) => event.type === 'turn.accepted'));
        expect(await run.backend.steerTurn!(turn('change direction', 'steer'))).toBe(true);
        await run.backend.dispose();
    });

    // Our own transport sends `cancel_async_message` here; the SDK has no public call for it.
    test('cannot withdraw a steer the CLI has not taken in when the person stops', async () => {
        const written: string[] = [];
        const fake = inProcess((io) => {
            const program = fakeClaude(io);

            return {
                onLine: (line) => {
                    written.push(line);

                    // Holds the steer back, as a CLI busy in a tool does.
                    if (!line.includes('"uuid":"late"')) {
                        program.onLine(line);
                    }
                }
            };
        });

        const backend = new ClaudeSdkBackend({ ...launch, spawn: fake.spawn }, { onEvent: () => undefined });
        await backend.start();
        backend.sendTurn(turn('slow', 'original'));
        void backend.steerTurn!(turn('change direction', 'late')).catch(() => undefined);
        await until(() => written.some((line) => line.includes('"uuid":"late"')));
        backend.interrupt();
        await until(() => written.some((line) => line.includes('"subtype":"interrupt"')));
        expect(written.some((line) => line.includes('cancel_async_message'))).toBe(false);
        await backend.dispose();
    });

    test('ends the CLI on dispose and reports nothing after it', async () => {
        const run = open('agent-sdk');
        await run.backend.start();
        expect(run.backend.pid).toBeGreaterThan(0);
        await run.backend.dispose();
        await run.cli.started[0]!.exited;
        expect(run.backend.running).toBe(false);
        expect(run.events.some((event) => event.type === 'exit')).toBe(false);
    });
});
