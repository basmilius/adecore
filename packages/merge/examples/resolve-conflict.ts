import { draftOf, joinLines, shapeOf, splitBlocks, splitLines } from '../src/index.ts';

const base = 'first\nsecond\n';
const ours = 'first\nour change\n';
const theirs = 'first\ntheir change\n';
const blocks = splitBlocks(splitLines(base), splitLines(ours), splitLines(theirs));
const draft = draftOf(blocks, new Map([[1, ['combined change']]]));
console.log(joinLines(draft.lines, shapeOf(base)));
