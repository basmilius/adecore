// What cmd.exe reads as syntax outside quotes, and so escapes with a caret.
const CMD_SPECIAL = /([()\][%!^"`<>&|;, *?])/g;

export function cmdEscaped(text: string): string {
    return text.replace(CMD_SPECIAL, '^$1');
}

/* The same on a line of a batch file, where cmd.exe reads `%` before any caret: only doubling keeps one. */
export function batchEscaped(text: string): string {
    return text.replace(/[()\][!^"`<>&|;, *?]/g, '^$&').replace(/%/g, '%%');
}

/* The script of a task, beside its definition. Without anything that would need quoting on its command line. */
export function scheduledTaskScriptName(label: string): string {
    return `${label.replace(/[^\w.-]/g, '_')}.cmd`;
}

/*
 * What a manager finds the cmd.exe of a task from before it had a script by: `schtasks /End` ends that
 * process alone, so a stop has to end the tree under it first. Its title is the label, which is the name
 * of the task. A task on a script is found by the script's name on the cmd.exe line.
 */
export function scheduledTaskMarker(label: string): string {
    return `title ${cmdEscaped(label)} && `;
}
