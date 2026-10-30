import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeSystemPromptArgs } from './claude-system-prompt.ts';

describe('claudeSystemPromptArgs', () => {
    let folder: string;

    beforeEach(() => {
        folder = mkdtempSync(join(tmpdir(), 'adecore-prompt-'));
    });

    afterEach(() => {
        rmSync(folder, { recursive: true, force: true });
    });

    it('passes the prompt on the flag outside Windows', () => {
        expect(claudeSystemPromptArgs('one\ntwo', 'darwin', folder)).toEqual(['--append-system-prompt', 'one\ntwo']);
    });

    it('passes a prompt with line breaks through a file on Windows', () => {
        const [flag, path] = claudeSystemPromptArgs('one\ntwo', 'win32', folder);

        expect(flag).toBe('--append-system-prompt-file');
        expect(readFileSync(path!, 'utf8')).toBe('one\ntwo');
    });

    it('gives different prompts different files, so one chat never reads another prompt', () => {
        const first = claudeSystemPromptArgs('one', 'win32', folder);
        const second = claudeSystemPromptArgs('two', 'win32', folder);

        expect(first[1]).not.toBe(second[1]);
    });
});
