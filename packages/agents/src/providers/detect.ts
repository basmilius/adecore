import { spawnChatProcess, type SpawnChatProcess } from '../chat/chat-process.ts';
import { definedEnv } from './accounts/launch.ts';

export interface CliDetection {
    installed: boolean;
    version: string | null;
}

/* Asks a CLI for its version; a missing binary is a plain "not installed", never an error. */
export async function detectCli(
    command: string,
    env: Record<string, string | undefined> = process.env,
    spawn: SpawnChatProcess = spawnChatProcess
): Promise<CliDetection> {
    try {
        let exited: (code: number | null) => void = () => undefined;
        const code = new Promise<number | null>((resolve) => {
            exited = resolve;
        });
        const proc = spawn({ command: [command, '--version'], cwd: process.cwd(), env: definedEnv(env), onExit: (exitCode) => exited(exitCode) });
        proc.stdin.end();
        const output = await new Response(proc.stdout).text();
        if ((await code) !== 0) {
            return { installed: false, version: null };
        }
        const version = /\d+\.\d+\.\d+/.exec(output)?.[0] ?? output.trim() ?? null;
        return { installed: true, version };
    } catch {
        return { installed: false, version: null };
    }
}
