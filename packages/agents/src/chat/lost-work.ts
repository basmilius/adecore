import type { ChatBackgroundTask, ChatItem } from '@adecore/agent-contracts';
import { commandLabel, type BackgroundWork } from './background-work.ts';

const NOTE_PREFIX = 'lost:';
const LEGACY_NOTE_PREFIX = 'lost-background-';
const TURN_NAME_LENGTH = 80;

/* What a host restart took down with the CLI of one chat, told to the agent in one note. */
export interface LostWork {
    /* The id of that note, made of the lost commands' and items' ids, so a second load writes no second one. */
    noteId: string;
    /* The turn the host went down in; null when the chat was idle. */
    turnId: string | null;
    /* Whether that turn is taken up again, so the note rides along with its resume prompt. */
    resumed: boolean;
    commands: ChatBackgroundTask[];
    work: BackgroundWork[];
}

export function lostWorkNoteId(commands: readonly ChatBackgroundTask[], work: readonly BackgroundWork[]): string {
    return NOTE_PREFIX + [...commands.map((command) => command.id), ...work.map((item) => item.id)].join(' ');
}

/* Whether a thread holds a note that told the agent this item was lost, in one note or the older note per item. */
export function toldLost(items: readonly ChatItem[], itemId: string): boolean {
    return items.some(
        (note) =>
            note.kind === 'note' &&
            (note.id === `${LEGACY_NOTE_PREFIX}${itemId}` || (note.id.startsWith(NOTE_PREFIX) && note.id.slice(NOTE_PREFIX.length).split(' ').includes(itemId)))
    );
}

/*
 * The note that tells the agent what the restart took: the turn it was in, every command by its full
 * text and every subagent or workflow, and that none of it reports back. `items` is the thread, which
 * names the turn by the prompt that opened it.
 */
export function lostWorkNote(lost: Pick<LostWork, 'turnId' | 'resumed' | 'commands' | 'work'>, items: readonly ChatItem[]): string {
    const turn = turnName(lost.turnId, items);
    const lines: string[] = [];

    if (turn === null) {
        lines.push('The machine restarted.');
    } else if (lost.resumed) {
        lines.push(`The machine restarted during your turn on ${turn}, which is taken up again now.`);
    } else {
        lines.push(`The machine restarted during your turn on ${turn}, which ended there.`);
    }

    lines.push('This background work ended with it and will not send a result:');

    for (const command of lost.commands) {
        lines.push(`- ${command.kind === 'monitor' ? 'monitor' : 'command'} ${quoted(commandLabel(command))}`);
    }

    for (const item of lost.work) {
        lines.push(`- ${workName(item)}`);
    }

    lines.push('Restart what is still needed.');

    return lines.join('\n');
}

function workName(item: BackgroundWork): string {
    if (item.kind === 'tool') {
        return `workflow ${quoted(item.workflow?.name || item.toolUseId)}`;
    }

    return `subagent ${quoted(item.description || item.subagentType || item.toolUseId)}`;
}

function turnName(turnId: string | null, items: readonly ChatItem[]): string | null {
    if (turnId === null) {
        return null;
    }

    const prompt = items.find((item) => item.kind === 'user' && item.turnId === turnId);

    if (prompt?.kind === 'user' && prompt.text.trim() !== '') {
        return quoted(shortened(prompt.text));
    }

    const turn = items.find((item) => item.id === turnId);

    return turn?.kind === 'turn' && turn.label ? quoted(shortened(turn.label)) : 'a turn without a prompt';
}

function shortened(text: string): string {
    const line = text.trim().replace(/\s+/g, ' ');

    return line.length <= TURN_NAME_LENGTH ? line : `${line.slice(0, TURN_NAME_LENGTH - 3)}...`;
}

function quoted(text: string): string {
    return `"${text}"`;
}
