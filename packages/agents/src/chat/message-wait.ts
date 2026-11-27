import type { ChatBackgroundTask } from '@adecore/agent-contracts';

// A command can run to hundreds of characters, and the note only has to point at it.
const LABEL_LENGTH = 60;

/* A background task as the note of a waiting message names it: what it does, else its command, cut to one short line. */
export function shortLabel(task: ChatBackgroundTask): string {
    const label = (task.description || task.command || task.id).split('\n', 1)[0]!.trim();

    return label.length > LABEL_LENGTH ? `${label.slice(0, LABEL_LENGTH - 1)}…` : label;
}

function listed(names: readonly string[]): string {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/*
 * Why a message waits for a new process: the work in its way (`until`, as "… ends") and what a person changed
 * since the launch. With no change of theirs the process itself has to go, after a failed sign-in for one.
 */
export function messageWaitNote(until: string, changes: readonly string[]): string {
    const reason = changes.length === 0 ? 'this chat needs a new process' : `${listed(changes)} changed`;

    return `Your message waits until ${until}, because ${reason}.`;
}
