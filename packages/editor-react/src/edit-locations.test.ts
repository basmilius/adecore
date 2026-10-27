import { describe, expect, test } from 'bun:test';
import { EditLocations, type EditPlace } from './edit-locations.ts';

const a = 'file:///a.ts';
const b = 'file:///b.ts';

function place(uri: string, line: number, character = 0): EditPlace {
    const position = { line, character };

    return { uri, selections: [{ start: position, end: position }] };
}

function linesOf(locations: EditLocations): number[] {
    return locations.places.map((entry) => entry.selections.at(-1)!.end.line);
}

describe('record', () => {
    test('merges an edit within three lines into the last place', () => {
        const locations = new EditLocations();

        locations.record(place(a, 10));
        locations.record(place(a, 13, 4));

        expect(locations.places).toEqual([place(a, 13, 4)]);
    });

    test('keeps an edit four lines away, in another file or with another number of carets', () => {
        const locations = new EditLocations();
        const two: EditPlace = { uri: a, selections: [place(a, 10).selections[0]!, place(a, 20).selections[0]!] };

        locations.record(place(a, 10));
        locations.record(place(a, 14));
        locations.record(place(b, 14));
        locations.record(two);

        expect(locations.places).toHaveLength(4);
    });

    test('forgets the oldest place past the limit', () => {
        const locations = new EditLocations(3);

        for (const line of [0, 10, 20, 30]) {
            locations.record(place(a, line));
        }

        expect(linesOf(locations)).toEqual([10, 20, 30]);
    });

    test('keeps 150 places by default', () => {
        const locations = new EditLocations();

        for (let line = 0; line < 160; line++) {
            locations.record(place(a, line * 10));
        }

        expect(locations.places).toHaveLength(150);
    });
});

describe('walking', () => {
    function filled(): EditLocations {
        const locations = new EditLocations();

        for (const line of [0, 10, 20]) {
            locations.record(place(a, line));
        }

        return locations;
    }

    test('previous skips the place the carets are on', () => {
        const locations = filled();

        expect(locations.previous(place(a, 21))).toEqual(place(a, 10));
        expect(locations.previous(place(a, 10))).toEqual(place(a, 0));
        expect(locations.previous(place(a, 0))).toBeNull();
    });

    test('next walks back to the later places and is not the exact opposite', () => {
        const locations = filled();

        locations.previous(place(a, 20));
        locations.previous(place(a, 10));

        expect(locations.next(place(a, 0))).toEqual(place(a, 10));
        expect(locations.next(place(a, 10))).toEqual(place(a, 20));
        expect(locations.next(place(a, 20))).toBeNull();
    });

    test('has no next place before a walk back', () => {
        expect(filled().next(null)).toBeNull();
    });

    test('a caret move puts the walk back at the end, but the move that arrives does not', () => {
        const locations = filled();

        locations.previous(place(a, 20));
        locations.moved(a, { line: 10, character: 3 });

        expect(locations.previous(place(a, 10))).toEqual(place(a, 0));

        locations.moved(a, { line: 5, character: 0 });

        expect(locations.previous(place(a, 5))).toEqual(place(a, 20));
    });

    test('an edit puts the walk back at the end', () => {
        const locations = filled();

        locations.previous(place(a, 20));
        locations.record(place(a, 30));

        expect(locations.previous(place(a, 30))).toEqual(place(a, 20));
    });

    test('walks across files', () => {
        const locations = new EditLocations();

        locations.record(place(a, 5));
        locations.record(place(b, 5));

        expect(locations.previous(place(b, 5))).toEqual(place(a, 5));
    });
});

describe('map', () => {
    test('moves the places of a file along with an insert above them', () => {
        const locations = new EditLocations();

        locations.record(place(a, 10, 4));
        locations.record(place(b, 10, 4));
        locations.map(a, [{ range: { start: { line: 2, character: 0 }, end: { line: 2, character: 0 } }, text: 'x\ny\n' }]);

        expect(locations.places).toEqual([place(a, 12, 4), place(b, 10, 4)]);
    });

    test('moves a place on the line of an edit by its length', () => {
        const locations = new EditLocations();

        locations.record(place(a, 3, 10));
        locations.map(a, [{ range: { start: { line: 3, character: 2 }, end: { line: 3, character: 4 } }, text: 'long' }]);

        expect(locations.places).toEqual([place(a, 3, 12)]);
    });

    test('moves a place up with a deletion above it', () => {
        const locations = new EditLocations();

        locations.record(place(a, 10, 4));
        locations.map(a, [{ range: { start: { line: 0, character: 0 }, end: { line: 4, character: 0 } }, text: '' }]);

        expect(locations.places).toEqual([place(a, 6, 4)]);
    });

    test('collapses a place inside removed text to the start of it', () => {
        const locations = new EditLocations();

        locations.record(place(a, 5, 2));
        locations.map(a, [{ range: { start: { line: 4, character: 1 }, end: { line: 6, character: 0 } }, text: '' }]);

        expect(locations.places).toEqual([place(a, 4, 1)]);
    });

    test('applies the changes in order', () => {
        const locations = new EditLocations();

        locations.record(place(a, 10));
        locations.map(a, [
            { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: '\n' },
            { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: '\n' }
        ]);

        expect(locations.places).toEqual([place(a, 12)]);
    });
});

describe('forget', () => {
    test('drops the places of the files it matches', () => {
        const locations = new EditLocations();

        locations.record(place(a, 0));
        locations.record(place(b, 0));
        locations.forget((uri) => uri === a);

        expect(locations.places).toEqual([place(b, 0)]);
    });
});
