import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/*
 * The flags that hand Claude its system prompt. npm installs the CLI as a batch file on Windows, and
 * a line through cmd.exe holds no line break and stops near 8 KB, so there the prompt goes in a file.
 * The name follows the content, so chats with the same prompt share one file and no chat removes it from under another.
 */
export function claudeSystemPromptArgs(instructions: string, platform: NodeJS.Platform = process.platform, folder: string = tmpdir()): string[] {
    if (platform !== 'win32') {
        return ['--append-system-prompt', instructions];
    }

    const digest = createHash('sha256').update(instructions).digest('hex').slice(0, 32);
    const path = join(folder, `adecore-claude-prompt-${digest}.md`);

    writeFileSync(path, instructions, { mode: 0o600 });

    return ['--append-system-prompt-file', path];
}
