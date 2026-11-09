import { afterEach, describe, expect, jest, test } from 'bun:test';
import type { ChatProcess, ChatSpawnOptions } from '../chat-process.ts';
import autoFallbackCapture from '../chat/fixtures/claude-2.1.285-auto-fallback.json';
import nativeChildrenCapture from '../chat/fixtures/claude-2.1.285-native-children.json';
import compactCapture from '../chat/fixtures/claude-2.1.285-resume-direct-compact.json';
import resumedTaskCapture from '../chat/fixtures/claude-2.1.285-resume-task-notification.json';
import goalCapture from '../chat/fixtures/claude-2.1.296-goal.json';
import interimCapture from '../chat/fixtures/claude-2.1.318-interim-subagent.json';
import compact319Capture from '../chat/fixtures/claude-2.1.319-resume-direct-compact.json';
import { fakeClaude } from '../testing/fake-claude.ts';
import { inProcess, type FakeCli, type FakeIo, type InProcessCli } from '../testing/fake-cli.ts';
import { claudeProvider } from '../testing/providers.ts';
import type { BackendEvent, BackendLaunch, TurnInput } from './backend.ts';
import { ClaudeBackend, type ClaudeBackendOptions } from './claude-backend.ts';
import { ClaudeProtocol } from './claude-protocol.ts';

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

afterEach(() => {
    jest.useRealTimers();
});

function turn(text: string, promptId?: string): TurnInput {
    return { text, preamble: null, attachments: [], mentions: [], skills: [], ...(promptId ? { promptId } : {}) };
}

async function flush(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
}

/* Settles once `check` holds; the SDK hands a frame on a few event-loop turns after the CLI wrote it. */
async function until(check: () => boolean): Promise<void> {
    for (let i = 0; i < 5_000 && !check(); i++) {
        await flush();
    }

    expect(check()).toBe(true);
}

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

interface Run {
    backend: ClaudeBackend;
    events: BackendEvent[];
    cli: InProcessCli;
}

function open(cli: FakeCli = fakeClaude, overrides: Partial<BackendLaunch> = {}, options: ClaudeBackendOptions = {}): Run {
    const fake = inProcess(cli);
    const events: BackendEvent[] = [];
    const backend = new ClaudeBackend({ ...launch, spawn: fake.spawn, ...overrides }, { onEvent: (event) => events.push(event) }, options);

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
        expect(backend.declineRequest(requestOf(events, 'approval.requested'), 'The person stopped the turn')).toBe(true);
        await quiet(events);
    },
    'one subagent stopped beside another': async ({ backend, events, cli }) => {
        backend.sendTurn(turn('two subagents', 'p1'));
        await until(() => events.filter((event) => event.type === 'task.started').length === 2);
        backend.stopTask('a-one');
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

// The snapshots were taken while the stream-json backend still ran beside this one and told the session the same, event for event.
describe('what a chat tells the session', () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
        test(name, async () => {
            const run = open();
            await run.backend.start();
            await scenario(run);
            await quiet(run.events);
            await run.backend.dispose();
            expect(run.events.some((event) => event.type === 'turn.done' || event.type === 'exit')).toBe(true);
            expect(stable(run.events)).toMatchSnapshot();
        });
    }
});

const INITIALIZED = { commands: [], agents: [], output_style: 'default', available_output_styles: [], models: [], account: {} };

/*
 * A CLI the test speaks for: it answers the handshake, keeps every line the SDK wrote, and answers any other
 * control request with `answer`, or with an empty success.
 */
function scripted(answer: (request: Record<string, unknown>) => unknown = () => ({})) {
    let io: FakeIo | null = null;
    const lines: Array<Record<string, unknown>> = [];

    const cli: FakeCli = (madeIo) => {
        io = madeIo;

        return {
            onLine: (line) => {
                const frame = JSON.parse(line) as Record<string, unknown>;
                lines.push(frame);

                if (frame.type !== 'control_request') {
                    return;
                }

                const request = frame.request as Record<string, unknown>;
                const body = request.subtype === 'initialize' ? INITIALIZED : answer(request);
                madeIo.out({ type: 'control_response', response: { subtype: 'success', request_id: frame.request_id, response: body } });
            }
        };
    };

    const out = (frame: unknown): void => {
        io?.out(frame);
    };

    const sent = (subtype: string): Array<Record<string, unknown>> =>
        lines.filter((line) => line.type === 'control_request' && (line.request as { subtype?: string }).subtype === subtype);

    return { cli, lines, out, sent, users: () => lines.filter((line) => line.type === 'user').map((line) => line.uuid) };
}

describe('a captured run', () => {
    const captures: Record<string, { frames: readonly unknown[] }> = {
        'claude-2.1.285-auto-fallback': autoFallbackCapture,
        'claude-2.1.285-native-children': nativeChildrenCapture,
        'claude-2.1.285-resume-direct-compact': compactCapture,
        'claude-2.1.285-resume-task-notification': resumedTaskCapture,
        'claude-2.1.296-goal': goalCapture,
        'claude-2.1.318-interim-subagent': interimCapture,
        'claude-2.1.319-resume-direct-compact': compact319Capture
    };

    for (const [name, capture] of Object.entries(captures)) {
        test(`${name} reaches the session as the protocol reads it`, async () => {
            const protocol = new ClaudeProtocol(null, launch.now, null);
            protocol.beginPrompt('captured-prompt');
            const expected = capture.frames.flatMap((frame) => protocol.handle(frame));

            const script = scripted();
            const run = open(script.cli);
            await run.backend.start();
            run.backend.sendTurn(turn('go', 'captured-prompt'));
            await until(() => script.users().length === 1);

            for (const frame of capture.frames) {
                script.out(frame);
            }

            await until(() => run.events.length >= expected.length);
            await quiet(run.events);
            await run.backend.dispose();
            expect(expected.length).toBeGreaterThan(0);
            expect(run.events).toEqual(expected);
        });
    }
});

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

describe('the Claude backend', () => {
    test("starts the person's own CLI with the launch command's arguments first, and maps the selection and the modes onto the SDK", async () => {
        const cli = recording();

        const backend = new ClaudeBackend(
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
            { onEvent: () => undefined },
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
        expect(spawned!.env.CLAUDE_CODE_ENTRYPOINT).toBe('sdk-ts');
        await backend.dispose();
    });

    test('loads the configuration of its folder unless the launch says otherwise', async () => {
        const run = open();
        await run.backend.start();
        const argv = run.cli.started[0]!.argv;
        expect(argv.some((arg) => arg.startsWith('--setting-sources'))).toBe(false);
        expect(argv).not.toContain('--strict-mcp-config');
        await run.backend.dispose();
    });

    test('hands the CLI its system prompt in the handshake, not on the command line', async () => {
        const run = open(fakeClaude, { instructions: 'You work in the motion editor.' });
        await run.backend.start();
        run.backend.sendTurn(turn('system?', 'p1'));
        await until(() => doneTurns(run.events) === 1);
        expect(run.events).toContainEqual(expect.objectContaining({ type: 'text.done', text: 'You work in the motion editor.' }));
        expect(run.cli.started[0]!.argv.some((arg) => arg.includes('system-prompt'))).toBe(false);
        await run.backend.dispose();
    });

    test('a 200k pick caps the compact window in the environment it starts the CLI in', async () => {
        const cli = recording();
        const backend = new ClaudeBackend(
            { ...launch, selection: { model: 'claude-sonnet-5', options: { contextWindow: '200k' } }, spawn: cli.spawn },
            { onEvent: () => undefined }
        );

        await backend.start();
        expect(cli.spawned[0]!.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe('200000');
        expect(cli.fake.started[0]!.argv[cli.fake.started[0]!.argv.indexOf('--settings') + 1]).toBe('{"autoCompactEnabled":true}');
        await backend.dispose();
    });

    test('keeps reading after an event consumer throws, and reports the failure without ending the CLI', async () => {
        const script = scripted();
        const fake = inProcess(script.cli);
        const events: BackendEvent[] = [];

        const backend = new ClaudeBackend(
            { ...launch, spawn: fake.spawn },
            {
                onEvent: (event) => {
                    if (event.type === 'text.done') {
                        throw new Error('consumer failed');
                    }

                    events.push(event);
                }
            }
        );

        await backend.start();
        script.out({ type: 'assistant', message: { id: 'text', content: [{ type: 'text', text: 'hello' }] } });
        script.out({ type: 'result', subtype: 'success' });
        await until(() => events.some((event) => event.type === 'turn.done'));
        expect(events).toContainEqual({ type: 'failed', message: 'Lost the connection to Claude: consumer failed', processAlive: true });
        expect(events).toContainEqual({ type: 'turn.done', state: 'done', costUsd: 0 });
        expect(backend.running).toBe(true);
        await backend.dispose();
    });

    test('a pipe that breaks under an answer fails the chat and takes no more messages', async () => {
        const script = scripted();
        const fake = inProcess(script.cli);
        let broken = false;

        const spawn = (options: ChatSpawnOptions): ChatProcess => {
            const process = fake.spawn(options);

            return {
                ...process,
                stdin: {
                    ...process.stdin,
                    write: (chunk) => {
                        if (broken) {
                            throw new Error('broken pipe');
                        }

                        return process.stdin.write(chunk);
                    }
                }
            };
        };

        const events: BackendEvent[] = [];
        const backend = new ClaudeBackend({ ...launch, spawn }, { onEvent: (event) => events.push(event) });
        await backend.start();
        script.out({
            type: 'control_request',
            request_id: 'approval',
            request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'true' }, tool_use_id: 'tool' }
        });
        await until(() => events.some((event) => event.type === 'approval.requested'));
        broken = true;
        expect(backend.respondApproval('approval', 'allow')).toBe(true);
        await until(() => events.some((event) => event.type === 'failed'));
        expect(events).toContainEqual({ type: 'failed', message: 'Lost the connection to Claude: broken pipe', processAlive: true });
        expect(backend.respondApproval('approval', 'allow')).toBe(false);
        expect(() => backend.sendTurn(turn('no'))).toThrow('Claude stdin is closed');
        await backend.dispose();
    });

    test('acknowledges a steer once the CLI replays it, without replacing the original prompt', async () => {
        const script = scripted();
        const run = open(script.cli);
        await run.backend.start();
        run.backend.sendTurn(turn('start', 'original'));
        let accepted = false;

        const sending = run.backend.steerTurn(turn('change direction', 'steer')).then((value) => {
            accepted = value;
        });

        await until(() => script.users().length === 2);
        expect(script.users()).toEqual(['original', 'steer']);
        expect(accepted).toBe(false);
        script.out({ type: 'user', uuid: 'steer', parent_tool_use_id: null, message: { role: 'user', content: [] } });
        await sending;
        expect(accepted).toBe(true);
        script.out({ type: 'result', subtype: 'success', user_message_uuids: ['original', 'steer'], total_cost_usd: 0 });
        await until(() => doneTurns(run.events) === 1);
        expect(run.events.filter((event) => event.type === 'turn.done')).toMatchObject([{ promptId: 'original', state: 'done' }]);
        expect(await run.backend.steerTurn(turn('too late'))).toBe(false);
        await run.backend.dispose();
    });

    test('withdraws a steer the CLI has not taken in when the person stops, so it does not run after the Stop', async () => {
        // The CLI still holds `late`; it had already taken `early` in.
        const script = scripted((request) => (request.subtype === 'cancel_async_message' ? { cancelled: request.message_uuid === 'late' } : {}));
        const run = open(script.cli);
        await run.backend.start();
        run.backend.sendTurn(turn('start', 'original'));
        const withdrawn = run.backend.steerTurn(turn('change direction', 'late'));
        const taken = run.backend.steerTurn(turn('also this', 'early'));
        await until(() => script.users().length === 3);
        run.backend.interrupt();
        await until(() => script.sent('cancel_async_message').length === 2);
        expect(script.sent('interrupt')).toHaveLength(1);
        expect(script.sent('cancel_async_message').map((line) => (line.request as { message_uuid?: string }).message_uuid)).toEqual(['late', 'early']);
        expect(await withdrawn).toBe(false);
        // A steer the CLI had taken in still waits for its echo.
        script.out({ type: 'user', uuid: 'early', parent_tool_use_id: null, message: { role: 'user', content: [] } });
        expect(await taken).toBe(true);
        await run.backend.dispose();
    });

    test('lets a steer run on after the Stop when the SDK cannot withdraw it, and its echo still settles it', async () => {
        const script = scripted();
        const run = open(script.cli);
        await run.backend.start();
        // A runtime without the undeclared call, which the backend checks for on the query object itself.
        Reflect.set(Reflect.get(run.backend, 'query') as object, 'cancelAsyncMessage', undefined);
        run.backend.sendTurn(turn('start', 'original'));
        const steering = run.backend.steerTurn(turn('change direction', 'late'));
        await until(() => script.users().length === 2);
        run.backend.interrupt();
        await until(() => script.sent('interrupt').length === 1);
        await quiet(script.lines);
        expect(script.sent('cancel_async_message')).toEqual([]);
        script.out({ type: 'user', uuid: 'late', parent_tool_use_id: null, message: { role: 'user', content: [] } });
        expect(await steering).toBe(true);
        await run.backend.dispose();
    });

    test('closes a stopped turn as aborted, without the error result the CLI ends it with', async () => {
        const script = scripted();
        const run = open(script.cli);
        await run.backend.start();
        run.backend.sendTurn(turn('start', 'original'));
        await until(() => script.users().length === 1);
        run.backend.interrupt();
        await until(() => script.sent('interrupt').length === 1);

        // What Claude Code 2.1.317 answers a stop with.
        script.out({
            type: 'result',
            subtype: 'error_during_execution',
            is_error: true,
            stop_reason: 'tool_use',
            terminal_reason: 'aborted_streaming',
            errors: ['[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=tool_use'],
            user_message_uuids: ['original'],
            total_cost_usd: 0.05
        });

        await until(() => doneTurns(run.events) === 1);
        expect(run.events.find((event) => event.type === 'turn.done')).toEqual({ type: 'turn.done', promptId: 'original', state: 'aborted', costUsd: 0.05 });
        await run.backend.dispose();
    });

    test('rejects an unacknowledged steer when the CLI goes away', async () => {
        const script = scripted();
        const run = open(script.cli);
        await run.backend.start();
        run.backend.sendTurn(turn('start'));
        const sending = run.backend.steerTurn(turn('change direction'));
        let reason = '';

        void sending.catch((error: Error) => {
            reason = error.message;
        });

        await until(() => script.users().length === 2);
        run.cli.started[0]!.crash(1);
        await until(() => run.events.some((event) => event.type === 'exit'));
        await flush();
        expect(run.backend.running).toBe(false);
        expect(reason).toContain('Claude stopped before it got your message');
    });

    test('waits for a steer through the whole turn, and rejects one it never echoed a grace after the turn ended', async () => {
        const script = scripted();
        const run = open(script.cli);
        await run.backend.start();
        run.backend.sendTurn(turn('start', 'original'));
        const late = run.backend.steerTurn(turn('next', 'late'));
        const lost = run.backend.steerTurn(turn('gone', 'lost')).catch((error: Error) => error);
        await until(() => script.users().length === 3);
        jest.useFakeTimers();
        jest.advanceTimersByTime(60 * 60_000);
        script.out({ type: 'result', subtype: 'success', user_message_uuids: ['original'], total_cost_usd: 0 });
        await until(() => doneTurns(run.events) === 1);
        jest.advanceTimersByTime(29_999);
        script.out({ type: 'user', uuid: 'late', parent_tool_use_id: null, message: { role: 'user', content: [] } });
        expect(await late).toBe(true);
        jest.advanceTimersByTime(1);
        expect((await lost) as Error).toMatchObject({ message: 'Claude ended its turn without taking your message' });
        jest.useRealTimers();
        await run.backend.dispose();
    });

    test('ends the CLI on dispose and reports nothing after it', async () => {
        const run = open();
        await run.backend.start();
        expect(run.backend.pid).toBeGreaterThan(0);
        await run.backend.dispose();
        await run.cli.started[0]!.exited;
        expect(run.backend.running).toBe(false);
        expect(run.events.some((event) => event.type === 'exit')).toBe(false);
    });
});

describe('the Claude backend on an API key', () => {
    const apiKey = { key: () => Promise.resolve('sk-ant-test'), configDir: '/tmp/claude-api' };
    const signedIn = { ...launch.env, CLAUDE_CODE_OAUTH_TOKEN: 'oauth', ANTHROPIC_AUTH_TOKEN: 'token', PATH: '/usr/bin' };
    const servers = [{ name: 'context', url: 'http://127.0.0.1:4210/mcp', headers: { Authorization: 'Bearer ${CONTEXT_TOKEN}' }, allowTools: true }];

    test('runs on the key alone, in a configuration of its own, with only the MCP servers of the launch', async () => {
        const cli = recording();
        const events: BackendEvent[] = [];
        const backend = new ClaudeBackend(
            { ...launch, env: signedIn, spawn: cli.spawn, mcpServers: servers },
            { onEvent: (event) => events.push(event) },
            { apiKey }
        );
        await backend.start();
        const { env, command } = cli.spawned[0]!;
        const argv = cli.fake.started[0]!.argv;

        expect(command[0]).toBe('claude');
        expect(env).toMatchObject({
            ANTHROPIC_API_KEY: 'sk-ant-test',
            CLAUDE_CONFIG_DIR: '/tmp/claude-api',
            DISABLE_AUTOUPDATER: '1',
            DISABLE_BUG_COMMAND: '1',
            DISABLE_ERROR_REPORTING: '1',
            DISABLE_TELEMETRY: '1',
            PATH: '/usr/bin'
        });
        // The umbrella variable would also keep the CLI from naming the session, which is where the chat's title comes from.
        expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBeUndefined();
        expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
        expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
        expect(argv).toEqual(expect.arrayContaining(['--setting-sources=', '--strict-mcp-config', '--allowedTools=mcp__context__*']));
        expect(JSON.parse(argv[argv.indexOf('--mcp-config') + 1]!)).toEqual({
            mcpServers: { context: { type: 'http', url: 'http://127.0.0.1:4210/mcp', headers: { Authorization: 'Bearer ${CONTEXT_TOKEN}' } } }
        });

        backend.sendTurn(turn('hello', 'p1'));
        await until(() => doneTurns(events) === 1);
        expect(events).toContainEqual(expect.objectContaining({ type: 'text.done', text: 'echo: hello' }));
        await backend.dispose();
    });

    test("sends the key nowhere but Anthropic's own API, whatever the host's environment points the CLI at", async () => {
        const cli = recording();

        const elsewhere = {
            ...signedIn,
            ANTHROPIC_BASE_URL: 'https://proxy.example',
            ANTHROPIC_BEDROCK_BASE_URL: 'https://bedrock.example',
            ANTHROPIC_VERTEX_BASE_URL: 'https://vertex.example',
            ANTHROPIC_FOUNDRY_RESOURCE: 'resource',
            ANTHROPIC_CUSTOM_HEADERS: 'X-Tap: 1',
            ANTHROPIC_API_KEY: 'sk-ant-other',
            CLAUDE_CODE_USE_BEDROCK: '1',
            CLAUDE_CODE_USE_VERTEX: '1',
            CLAUDE_CODE_USE_FOUNDRY: '1',
            CLAUDE_CODE_SKIP_BEDROCK_AUTH: '1',
            AWS_BEARER_TOKEN_BEDROCK: 'bedrock-token',
            AWS_REGION: 'eu-west-1',
            CLAUDE_CODE_MAX_OUTPUT_TOKENS: '32000'
        };

        const backend = new ClaudeBackend({ ...launch, env: elsewhere, spawn: cli.spawn }, { onEvent: () => undefined }, { apiKey });
        await backend.start();
        const { env } = cli.spawned[0]!;
        const carried = Object.keys(env).filter((name) => name.startsWith('ANTHROPIC_') || name.startsWith('CLAUDE_CODE_USE_') || name.includes('_AUTH'));

        expect(carried).toEqual(['ANTHROPIC_API_KEY']);
        expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-test');
        expect(env.AWS_BEARER_TOKEN_BEDROCK).toBeUndefined();
        expect(env).toMatchObject({ AWS_REGION: 'eu-west-1', CLAUDE_CODE_MAX_OUTPUT_TOKENS: '32000' });
        await backend.dispose();
    });

    for (const how of ['stop', 'dispose'] as const) {
        test(`starts no CLI once a ${how} came while the key was still being read`, async () => {
            const cli = recording();
            const read = Promise.withResolvers<string>();
            const backend = new ClaudeBackend(
                { ...launch, spawn: cli.spawn },
                { onEvent: () => undefined },
                { apiKey: { ...apiKey, key: () => read.promise } }
            );
            const starting = backend.start();

            if (how === 'stop') {
                backend.stop();
            } else {
                await backend.dispose();
            }

            read.resolve('sk-ant-test');
            await starting;
            await quiet(cli.spawned);
            expect(cli.spawned).toEqual([]);
            expect(backend.running).toBe(false);
        });
    }
});

describe('a change to a running Claude process', () => {
    const sonnet = { model: 'claude-sonnet-5', options: { effort: 'high', contextWindow: '1m' } };

    test('takes the model, the effort, fast mode and the permission mode without a new process', async () => {
        const script = scripted();
        const run = open(script.cli, { selection: sonnet, runtimeMode: 'supervised' });
        await run.backend.start();

        const took = await run.backend.reconfigure({
            selection: { model: 'claude-opus-5', options: { effort: 'xhigh', contextWindow: '1m', fastMode: true } },
            runtimeMode: 'auto-accept-edits'
        });

        expect(took).toBe(true);
        expect(run.cli.started).toHaveLength(1);
        expect(script.sent('set_model').map((line) => line.request)).toEqual([{ subtype: 'set_model', model: 'claude-opus-5[1m]' }]);
        expect(script.sent('apply_flag_settings').map((line) => line.request)).toEqual([
            { subtype: 'apply_flag_settings', settings: { effortLevel: 'xhigh', fastMode: true } }
        ]);
        expect(script.sent('set_permission_mode').map((line) => line.request)).toEqual([{ subtype: 'set_permission_mode', mode: 'acceptEdits' }]);
        await run.backend.dispose();
    });

    test('puts ultrathink in front of the next prompt once the effort moved there', async () => {
        const script = scripted();
        const run = open(script.cli, { selection: sonnet });
        await run.backend.start();
        expect(
            await run.backend.reconfigure({ selection: { ...sonnet, options: { ...sonnet.options, effort: 'ultrathink' } }, runtimeMode: 'supervised' })
        ).toBe(true);
        expect(script.sent('apply_flag_settings').map((line) => line.request)).toEqual([{ subtype: 'apply_flag_settings', settings: { effortLevel: null } }]);
        run.backend.sendTurn(turn('think hard', 'p1'));
        await until(() => script.users().length === 1);
        const user = script.lines.find((line) => line.type === 'user') as { message: { content: Array<{ text: string }> } };
        expect(user.message.content[0]!.text).toBe('ultrathink\n\nthink hard');
        await run.backend.dispose();
    });

    for (const [name, change, launched] of [
        [
            'a context window that moves where it compacts',
            { selection: { ...sonnet, options: { ...sonnet.options, contextWindow: '200k' } }, runtimeMode: 'supervised' },
            'supervised'
        ],
        ['bypassing permissions in a process started without it', { selection: sonnet, runtimeMode: 'full-access' }, 'auto']
    ] as const) {
        test(`needs a new process for ${name}`, async () => {
            const script = scripted();
            const run = open(script.cli, { selection: sonnet, runtimeMode: launched });
            await run.backend.start();
            expect(await run.backend.reconfigure(change)).toBe(false);
            expect(script.sent('set_model')).toEqual([]);
            expect(script.sent('set_permission_mode')).toEqual([]);
            await run.backend.dispose();
        });
    }

    test('leaves full access for a narrower mode in place', async () => {
        const script = scripted();
        const run = open(script.cli, { selection: sonnet, runtimeMode: 'full-access' });
        await run.backend.start();
        expect(await run.backend.reconfigure({ selection: sonnet, runtimeMode: 'supervised' })).toBe(true);
        expect(script.sent('set_permission_mode').map((line) => line.request)).toEqual([{ subtype: 'set_permission_mode', mode: 'default' }]);
        await run.backend.dispose();
    });
});

describe('the entrypoint the CLI names its host by', () => {
    const entrypointOf = async (options: ClaudeBackendOptions): Promise<string | undefined> => {
        const cli = recording();
        const backend = new ClaudeBackend({ ...launch, spawn: cli.spawn }, { onEvent: () => undefined }, options);
        await backend.start();
        await backend.dispose();

        return cli.spawned[0]!.env.CLAUDE_CODE_ENTRYPOINT;
    };

    test("is the host's own when it names one, on the person's sign-in and on an API key alike", async () => {
        expect(await entrypointOf({ entrypoint: 'motion-editor' })).toBe('motion-editor');
        expect(await entrypointOf({ entrypoint: 'motion-editor', apiKey: { key: () => 'sk-ant-test', configDir: '/tmp/claude-api' } })).toBe('motion-editor');
    });

    test("is the SDK's own otherwise", async () => {
        expect(await entrypointOf({})).toBe('sdk-ts');
    });
});

describe('the Claude backend letting go', () => {
    test('reports the exit of a CLI whose stdout a process it started still holds open', async () => {
        let exit: ChatSpawnOptions['onExit'] = () => undefined;

        const spawn = (options: ChatSpawnOptions): ChatProcess => {
            exit = options.onExit;

            return {
                pid: 4242,
                stdin: { write: () => 0, flush: () => 0, end: () => 0 },
                // Never closed: a dev server the agent started inherited it.
                stdout: new ReadableStream<Uint8Array>(),
                kill: () => undefined
            };
        };

        const events: BackendEvent[] = [];
        const backend = new ClaudeBackend({ ...launch, spawn }, { onEvent: (event) => events.push(event) });
        await backend.start();
        jest.useFakeTimers();
        exit(1, null);
        await flush();
        jest.advanceTimersByTime(1_000);
        jest.useRealTimers();
        await until(() => events.some((event) => event.type === 'exit'));
        expect(events).toContainEqual({ type: 'exit', exitCode: 1 });
        expect(backend.running).toBe(false);
    });

    test('turns down a request the CLI still waits on when the backend is disposed', async () => {
        const script = scripted();
        const run = open(script.cli);
        await run.backend.start();
        const ask = Reflect.get(run.backend, 'askPermission') as (toolName: string, input: Record<string, unknown>, options: unknown) => Promise<unknown>;
        const answer = ask.call(run.backend, 'Bash', { command: 'ls' }, { requestId: 'req-1', toolUseID: 'toolu_1', signal: new AbortController().signal });
        await run.backend.dispose();
        expect(await answer).toEqual({ behavior: 'deny', message: 'Claude stopped' });
    });
});
