import { describe, expect, test } from 'bun:test';
import {
    chipRanges,
    chipText,
    findMentionQuery,
    findReferenceQuery,
    findSkillQuery,
    insertMention,
    insertReference,
    insertSkill,
    mentionPick,
    NO_MENTION_SEARCH,
    pastedMentions,
    presentMentions,
    presentReferences,
    presentSkills,
    tokenizeChips
} from './mentions';

describe('findMentionQuery', () => {
    test('opens on an @ that starts a word and follows it to the caret', () => {
        expect(findMentionQuery('look at @src/ch', 15)).toEqual({ start: 8, query: 'src/ch' });
        expect(findMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    });

    test('stays closed for an email, a closed word or a caret inside a word', () => {
        expect(findMentionQuery('mail bas@x', 10)).toBeNull();
        expect(findMentionQuery('@done and more', 14)).toBeNull();
        expect(findMentionQuery('@src/chat', 4)).toBeNull();
    });
});

describe('mentionPick', () => {
    test('picks the file the current query found', () => {
        const search = { query: 'pack', files: ['package.json', 'packages/a.ts'] };
        expect(mentionPick(1, search, 'pack')).toBe('packages/a.ts');
    });

    test('picks no file while the answer for the query typed since is on its way', () => {
        // `@` answered at once, then `@pack` and Enter came before its debounced search did.
        const search = { query: '', files: ['README.md', 'src/main.ts'] };
        expect(mentionPick(0, search, 'pack')).toBeNull();
        expect(mentionPick(0, NO_MENTION_SEARCH, '')).toBeNull();
    });
});

describe('insertMention', () => {
    test('swaps the query for the path plus a space and moves the caret behind it', () => {
        const mention = findMentionQuery('see @cmp now', 8)!;
        expect(insertMention('see @cmp now', mention, 'src/Composer.tsx')).toEqual({ text: 'see @src/Composer.tsx  now', caret: 22 });
    });
});

describe('findReferenceQuery', () => {
    test('opens on a # with a letter right after it, also a letter outside ASCII', () => {
        expect(findReferenceQuery('draw in #Sch', 12)).toEqual({ start: 8, query: 'Sch' });
        expect(findReferenceQuery('#Ébauche', 8)).toEqual({ start: 0, query: 'Ébauche' });
    });

    test('leaves a heading, a number, a bare # and a color as no query of its own', () => {
        expect(findReferenceQuery('# Title', 7)).toBeNull();
        expect(findReferenceQuery('#', 1)).toBeNull();
        expect(findReferenceQuery('issue #123', 10)).toBeNull();
        expect(findReferenceQuery('a#b', 3)).toBeNull();
    });
});

describe('insertReference', () => {
    test('puts the whole name in, spaces and all, where the first word was typed', () => {
        const query = findReferenceQuery('see #Onder now', 10)!;
        expect(insertReference('see #Onder now', query, 'Onderzoek Q3')).toEqual({ text: 'see #Onderzoek Q3  now', caret: 18 });
    });
});

describe('references in the text', () => {
    const tokens = [
        { id: 'view-q3', name: 'Onderzoek Q3' },
        { id: 'view-research', name: 'Onderzoek' },
        { id: 'node-sketch', name: 'Sketch' }
    ];

    test('chipRanges finds a name with a space by the id it stands for, the longer name first', () => {
        const text = 'Compare #Onderzoek Q3 with #Onderzoek.';
        const ranges = chipRanges(text, [], [], [], tokens);
        expect(ranges).toEqual([
            { from: 8, to: 21, kind: 'reference', value: 'view-q3' },
            { from: 27, to: 37, kind: 'reference', value: 'view-research' }
        ]);
        expect(ranges.map((range) => text.slice(range.from, range.to))).toEqual(['#Onderzoek Q3', '#Onderzoek']);
    });

    test('a reference in a code span stays text', () => {
        expect(chipRanges('`#Sketch` and #Sketch', [], [], [{ from: 0, to: 9 }], tokens)).toEqual([
            { from: 14, to: 21, kind: 'reference', value: 'node-sketch' }
        ]);
    });

    test('tokenizeChips keeps the name the text spells and spells the text again', () => {
        const text = 'Draw a sun in #Sketch, see @a.ts';
        const segments = tokenizeChips(text, ['a.ts'], [], tokens);
        expect(segments).toEqual([
            { kind: 'text', text: 'Draw a sun in ' },
            { kind: 'reference', id: 'node-sketch', name: 'Sketch' },
            { kind: 'text', text: ', see ' },
            { kind: 'mention', path: 'a.ts' }
        ]);
        expect(segments.map(chipText).join('')).toBe(text);
    });

    test('presentReferences keeps the picked ids still in the text, in text order', () => {
        expect(presentReferences('#Sketch then #Onderzoek Q3', ['view-q3', 'node-sketch', 'view-research'], tokens)).toEqual(['node-sketch', 'view-q3']);
        expect(presentReferences('#Sketch', ['view-q3'], tokens)).toEqual([]);
    });
});

describe('presentMentions', () => {
    test('keeps only chosen paths that still sit whole in the text, in text order', () => {
        expect(presentMentions('fix @b.ts then @a.ts', ['a.ts', 'b.ts', 'gone.ts'])).toEqual(['b.ts', 'a.ts']);
        expect(presentMentions('@a.tsx', ['a.ts'])).toEqual([]);
    });
});

describe('tokenizeChips', () => {
    test('splits text around the chips and prefers the longer path', () => {
        expect(tokenizeChips('open @src/a.ts and @src/a.ts.bak.', ['src/a.ts', 'src/a.ts.bak'])).toEqual([
            { kind: 'text', text: 'open ' },
            { kind: 'mention', path: 'src/a.ts' },
            { kind: 'text', text: ' and ' },
            { kind: 'mention', path: 'src/a.ts.bak' },
            { kind: 'text', text: '.' }
        ]);
    });

    test('plain text without mentions is one segment', () => {
        expect(tokenizeChips('hello', [])).toEqual([{ kind: 'text', text: 'hello' }]);
        expect(tokenizeChips('', ['x'])).toEqual([]);
    });
});

describe('findSkillQuery', () => {
    test('opens on a $ that starts a word whose name starts with a letter', () => {
        expect(findSkillQuery('run $uns', 8)).toEqual({ start: 4, query: 'uns' });
        expect(findSkillQuery('$', 1)).toEqual({ start: 0, query: '' });
    });

    test('stays closed for an amount, a closed word or a caret inside a word', () => {
        expect(findSkillQuery('it costs $20', 12)).toBeNull();
        expect(findSkillQuery('$unslop and more', 16)).toBeNull();
        expect(findSkillQuery('paid us$5', 9)).toBeNull();
    });
});

describe('insertSkill', () => {
    test('swaps the query for the name plus a space', () => {
        const query = findSkillQuery('run $uns now', 8)!;
        expect(insertSkill('run $uns now', query, 'unslop')).toEqual({ text: 'run $unslop  now', caret: 12 });
    });
});

describe('presentSkills', () => {
    test('keeps only chosen names that still sit whole in the text', () => {
        expect(presentSkills('first $lint then $unslop', ['unslop', 'lint', 'gone'])).toEqual(['lint', 'unslop']);
    });
});

describe('tokenizeChips with skills', () => {
    test('draws mentions and skills as their own segments', () => {
        expect(tokenizeChips('read @a.ts then $unslop it', ['a.ts'], ['unslop'])).toEqual([
            { kind: 'text', text: 'read ' },
            { kind: 'mention', path: 'a.ts' },
            { kind: 'text', text: ' then ' },
            { kind: 'skill', name: 'unslop' },
            { kind: 'text', text: ' it' }
        ]);
    });
});

describe('chipText', () => {
    test('a chip stands for the sigil the text carries and its value', () => {
        expect(chipText({ kind: 'mention', path: 'src/a.ts' })).toBe('@src/a.ts');
        expect(chipText({ kind: 'skill', name: 'unslop' })).toBe('$unslop');
        expect(chipText({ kind: 'text', text: '  two spaces  ' })).toBe('  two spaces  ');
    });

    test('the segments of a prompt spell that prompt again', () => {
        const long = `${'nested/'.repeat(10)}2026-09-10-tekenview.html`;
        const cases: Array<[string, string[], string[]]> = [
            ['@docs/reports/2026-09-10-tekenview.html this is a test', ['docs/reports/2026-09-10-tekenview.html'], []],
            ['$unslop', [], ['unslop']],
            ['run $unslop over @README.md, then @docs/HANDOFF.md.', ['README.md', 'docs/HANDOFF.md'], ['unslop']],
            ['open @src/a.ts and @src/a.ts.bak.', ['src/a.ts', 'src/a.ts.bak'], []],
            ['line one\n@a.ts opens the next one\n', ['a.ts'], []],
            [`${'a word '.repeat(20)}@${long} and a tail that wraps`, [long], []],
            ['nothing of the chosen is left', ['gone.ts'], ['gone']],
            ['', ['a.ts'], ['unslop']]
        ];
        for (const [text, mentions, skills] of cases) {
            expect(tokenizeChips(text, mentions, skills).map(chipText).join('')).toBe(text);
        }
    });
});

describe('chipRanges', () => {
    test('finds the same tokens tokenizeChips draws, with their offsets', () => {
        const text = 'run $unslop over @README.md, then @docs/HANDOFF.md.';
        const ranges = chipRanges(text, ['README.md', 'docs/HANDOFF.md'], ['unslop']);
        expect(ranges).toEqual([
            { from: 4, to: 11, kind: 'skill', value: 'unslop' },
            { from: 17, to: 27, kind: 'mention', value: 'README.md' },
            { from: 34, to: 50, kind: 'mention', value: 'docs/HANDOFF.md' }
        ]);
        expect(ranges.map((range) => text.slice(range.from, range.to))).toEqual(['$unslop', '@README.md', '@docs/HANDOFF.md']);
        const chips = tokenizeChips(text, ['README.md', 'docs/HANDOFF.md'], ['unslop']).filter((segment) => segment.kind !== 'text');
        expect(chips.map(chipText)).toEqual(ranges.map((range) => text.slice(range.from, range.to)));
    });

    test('lets the longer of two values that share a prefix win', () => {
        expect(chipRanges('open @src/a.ts.bak.', ['src/a.ts', 'src/a.ts.bak'])).toEqual([{ from: 5, to: 18, kind: 'mention', value: 'src/a.ts.bak' }]);
    });

    test('leaves a token inside an excluded range as text', () => {
        // `@a.ts` is a code span from 4 to 11.
        expect(chipRanges('see `@a.ts` and @a.ts', ['a.ts'], [], [{ from: 4, to: 11 }])).toEqual([{ from: 16, to: 21, kind: 'mention', value: 'a.ts' }]);
    });

    test('keeps a token right after a closed code span', () => {
        expect(chipRanges('`x` @a.ts', ['a.ts'], [], [{ from: 0, to: 3 }])).toEqual([{ from: 4, to: 9, kind: 'mention', value: 'a.ts' }]);
    });

    test('finds nothing in empty text or for values that are gone', () => {
        expect(chipRanges('', ['a.ts'])).toEqual([]);
        expect(chipRanges('nothing here', ['gone.ts'], ['gone'])).toEqual([]);
    });
});

describe('pastedMentions', () => {
    test('reads the paths of a text that is only @paths, one per line or space apart', () => {
        expect(pastedMentions('@README.md\n@src/sample.txt\n')).toEqual(['README.md', 'src/sample.txt']);
        expect(pastedMentions('@a.ts @a.ts @b.ts')).toEqual(['a.ts', 'b.ts']);
    });

    test('leaves any other text alone', () => {
        expect(pastedMentions('')).toEqual([]);
        expect(pastedMentions('look at @README.md')).toEqual([]);
        expect(pastedMentions('mail me@example.com')).toEqual([]);
        expect(pastedMentions('@')).toEqual([]);
    });
});

test('mention drags read neutral and transitional formats and write both for older receivers', async () => {
    const { MENTION_DRAG_TYPE, LEGACY_MENTION_DRAG_TYPE, carriesMentions, droppedMentions, writeMentionDrag } = await import('./mentions');
    const values = new Map<string, string>();
    const data = {
        getData: (type: string) => values.get(type) ?? '',
        setData: (type: string, value: string) => {
            values.set(type, value);
        }
    };
    values.set(LEGACY_MENTION_DRAG_TYPE, 'src/a.ts src/b.ts');
    expect(carriesMentions([LEGACY_MENTION_DRAG_TYPE])).toBe(true);
    expect(droppedMentions(data)).toEqual(['src/a.ts', 'src/b.ts']);
    values.set(MENTION_DRAG_TYPE, 'src/new.ts');
    expect(droppedMentions(data)).toEqual(['src/new.ts']);
    writeMentionDrag(data, ['one.ts', 'two.ts']);
    expect(values.get(MENTION_DRAG_TYPE)).toBe('one.ts two.ts');
    expect(values.get(LEGACY_MENTION_DRAG_TYPE)).toBe('one.ts two.ts');
    expect(carriesMentions([MENTION_DRAG_TYPE])).toBe(true);
    expect(carriesMentions(['Files'])).toBe(false);
    values.clear();
    expect(droppedMentions(data)).toEqual([]);
    writeMentionDrag(data, ['new.ts'], false);
    expect(values.has(LEGACY_MENTION_DRAG_TYPE)).toBe(false);
});
