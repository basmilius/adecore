import type { EditorContentChange, EditorPosition, EditorRange } from '@adecore/editor';
import { comparePositions, endOfInsertion } from './positions.ts';

/* Where an edit left the carets of one file, the primary last. */
export interface EditPlace {
    readonly uri: string;
    readonly selections: readonly EditorRange[];
}

const LIMIT = 150;

/* Two places are one when they are in one file with as many carets, and every caret is within three lines of its twin. */
function isSame(left: EditPlace, right: EditPlace | null): boolean {
    return (
        right !== null &&
        left.uri === right.uri &&
        left.selections.length === right.selections.length &&
        left.selections.every((selection, index) => Math.abs(selection.end.line - right.selections[index]!.end.line) < 4)
    );
}

/* A position after a change: untouched in front of it, at the start when the change replaced the text around it, moved along behind it. */
function follow(position: EditorPosition, change: EditorContentChange): EditorPosition {
    const { start, end } = change.range;

    if (comparePositions(start, position) >= 0) {
        return position;
    }

    if (comparePositions(position, end) < 0) {
        return start;
    }

    const landed = endOfInsertion(start, change.text);

    return position.line === end.line
        ? { line: landed.line, character: landed.character + position.character - end.character }
        : { line: position.line + landed.line - end.line, character: position.character };
}

/*
 * Where the project was edited, for Last Edit Location and Next Edit Location. An edit within three lines of the
 * last one is the same place, so typing a paragraph is one stop. A caret that moves without an edit puts the walk
 * back at the end, and so does an edit.
 */
export class EditLocations {
    private readonly limit: number;
    private entries: EditPlace[] = [];
    private index = 0;
    private arriving: { uri: string; line: number } | null = null;

    constructor(limit = LIMIT) {
        this.limit = limit;
    }

    get places(): readonly EditPlace[] {
        return this.entries;
    }

    record(place: EditPlace): void {
        const last = this.entries.at(-1);

        if (last !== undefined && isSame(last, place)) {
            this.entries[this.entries.length - 1] = place;
        } else {
            this.entries.push(place);

            if (this.entries.length > this.limit) {
                this.entries.shift();
            }
        }

        this.index = this.entries.length;
        this.arriving = null;
    }

    /* The caret moved without an edit. The move that lands on the place a walk went to does not count. */
    moved(uri: string, position: EditorPosition): void {
        if (this.arriving?.uri === uri && this.arriving.line === position.line) {
            return;
        }

        this.arriving = null;
        this.index = this.entries.length;
    }

    /* The place of an earlier edit that is not the one the carets are on; null when there is none. */
    previous(current: EditPlace | null): EditPlace | null {
        for (let i = this.index - 1; i >= 0; i--) {
            if (!isSame(this.entries[i]!, current)) {
                this.index = i;

                return this.arrive(this.entries[i]!);
            }
        }

        return null;
    }

    /* The place of a later edit; it moves one past the place it returns, so Last Edit Location and Next Edit Location are not exact opposites. */
    next(current: EditPlace | null): EditPlace | null {
        for (let i = this.index; i < this.entries.length; i++) {
            if (!isSame(this.entries[i]!, current)) {
                this.index = i + 1;

                return this.arrive(this.entries[i]!);
            }
        }

        return null;
    }

    /* The places of a file follow its edits, in the order the editor made them. */
    map(uri: string, changes: readonly EditorContentChange[]): void {
        if (!this.entries.some((entry) => entry.uri === uri)) {
            return;
        }

        this.entries = this.entries.map((entry) => {
            if (entry.uri !== uri) {
                return entry;
            }

            const selections = changes.reduce(
                (current, change) => current.map((selection) => ({ start: follow(selection.start, change), end: follow(selection.end, change) })),
                entry.selections
            );

            return { uri, selections };
        });
    }

    forget(matches: (uri: string) => boolean): void {
        this.entries = this.entries.filter((entry) => !matches(entry.uri));
        this.index = this.entries.length;

        if (this.arriving !== null && matches(this.arriving.uri)) {
            this.arriving = null;
        }
    }

    private arrive(place: EditPlace): EditPlace {
        this.arriving = { uri: place.uri, line: place.selections.at(-1)!.end.line };

        return place;
    }
}
