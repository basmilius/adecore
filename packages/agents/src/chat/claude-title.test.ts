import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeTitleReader } from './claude-title.ts';

function line(record: object): string {
    return `${JSON.stringify(record)}\n`;
}

// What a transcript of Claude Code 2.1.270 looks like around its title: the record comes early, late and twice.
const FIXTURE = [
    line({ type: 'ai-title', aiTitle: 'First guess', sessionId: 'abc' }),
    line({ type: 'user', message: { role: 'user', content: 'Why does the "ai-title" test fail?' }, sessionId: 'abc' }),
    line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Looking.' }] }, sessionId: 'abc' }),
    line({ type: 'ai-title', aiTitle: '  Fix flaky\ntitle test  ', sessionId: 'abc' })
].join('');

let root: string;
let transcript: string;

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ruimte-title-'));
    await mkdir(join(root, '-Users-someone-project'), { recursive: true });
    transcript = join(root, '-Users-someone-project', 'abc.jsonl');
    await writeFile(transcript, FIXTURE);
});

afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});

describe('ClaudeTitleReader', () => {
    test('takes the last ai-title in the file, cleaned to one line', async () => {
        expect(await new ClaudeTitleReader(root).forTranscript(transcript)).toBe('Fix flaky title test');
    });

    test('finds the transcript of a session by its file name', async () => {
        const reader = new ClaudeTitleReader(root);
        expect(await reader.forSession('abc')).toBe('Fix flaky title test');
        expect(await reader.forSession('missing')).toBeNull();
        expect(await reader.forSession('../abc')).toBeNull();
    });

    test('a session without a title answers null', async () => {
        await writeFile(transcript, line({ type: 'user', message: { role: 'user', content: 'hi' } }));
        expect(await new ClaudeTitleReader(root).forTranscript(transcript)).toBeNull();
        expect(await new ClaudeTitleReader(root).forTranscript(join(root, 'nope.jsonl'))).toBeNull();
    });

    test('reads on from where it stopped, and leaves a half-written line for later', async () => {
        const reader = new ClaudeTitleReader(root);
        expect(await reader.forTranscript(transcript)).toBe('Fix flaky title test');

        const later = line({ type: 'ai-title', aiTitle: 'Second name' });
        await appendFile(transcript, later.slice(0, 20));
        expect(await reader.forTranscript(transcript)).toBe('Fix flaky title test');
        await appendFile(transcript, later.slice(20));
        expect(await reader.forTranscript(transcript)).toBe('Second name');
    });

    test('a file read in pieces smaller than a line, split inside a character, reads the same', async () => {
        await writeFile(
            transcript,
            [line({ type: 'user', content: 'ü'.repeat(50) }), line({ type: 'ai-title', aiTitle: 'Übersicht der Änderungen' })].join('')
        );

        expect(await new ClaudeTitleReader(root, 7).forTranscript(transcript)).toBe('Übersicht der Änderungen');
    });

    test('a name a person set with /rename wins over the generated one', async () => {
        await appendFile(transcript, line({ type: 'custom-title', customTitle: 'My name', sessionId: 'abc' }));
        await appendFile(transcript, line({ type: 'ai-title', aiTitle: 'Later guess', sessionId: 'abc' }));
        expect(await new ClaudeTitleReader(root).forTranscript(transcript)).toBe('My name');
    });

    test('a replaced file is read again from the start', async () => {
        const reader = new ClaudeTitleReader(root);
        await reader.forTranscript(transcript);
        await writeFile(transcript, line({ type: 'ai-title', aiTitle: 'New' }));
        expect(await reader.forTranscript(transcript)).toBe('New');
    });
});
