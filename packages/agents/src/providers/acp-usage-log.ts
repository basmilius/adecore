import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AcpUsageReport } from '../chat/acp-backend.ts';
import { errorText } from '../error-text.ts';
import { hostUsageLine } from '../usage/readers/host-log.ts';

/*
 * Appends one turn to the session's own file in the folder, so a scan that hashes what it already read
 * of a file never rereads the log of every other session. Written at once, since it is one line per turn.
 */
export function writeAcpUsage(folder: string, report: AcpUsageReport, at: number): void {
    const { sessionId, cwd, model, ...tokens } = report;

    try {
        mkdirSync(folder, { recursive: true, mode: 0o700 });

        appendFileSync(
            join(folder, `${encodeURIComponent(sessionId === '' ? 'session' : sessionId)}.jsonl`),
            hostUsageLine({ at, model, session: sessionId, cwd, ...tokens }),
            {
                mode: 0o600
            }
        );
    } catch (e) {
        // A turn whose line could not be written is missing from the usage page; the chat itself goes on.
        console.warn('Could not write the usage of an ACP turn:', errorText(e));
    }
}
