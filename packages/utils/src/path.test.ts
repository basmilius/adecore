import { describe, expect, test } from 'bun:test';
import { join, win32 } from 'node:path';
import { climbsOut, isBelow, isWithin } from './path.ts';

describe('climbsOut', () => {
    test('leaves the folder for a parent, a path through a parent and an absolute path', () => {
        expect(climbsOut('..')).toBe(true);
        expect(climbsOut(join('..', 'other'))).toBe(true);
        expect(climbsOut('/elsewhere')).toBe(true);
    });

    test('stays for a name that only starts with two dots', () => {
        expect(climbsOut('..cache')).toBe(false);
        expect(climbsOut(join('..cache', 'file'))).toBe(false);
        expect(climbsOut('')).toBe(false);
    });
});

describe('isWithin and isBelow', () => {
    test('count the folder itself only within', () => {
        expect(isWithin('/project', '/project')).toBe(true);
        expect(isBelow('/project', '/project')).toBe(false);
    });

    test('accept a path below, a name with leading dots included', () => {
        expect(isWithin('/project', '/project/src/index.ts')).toBe(true);
        expect(isBelow('/project', '/project/..cache')).toBe(true);
    });

    test('refuse a sibling that shares the prefix and a path that climbs out after normalizing', () => {
        expect(isWithin('/project', '/project-other/file')).toBe(false);
        expect(isBelow('/project', '/project/src/../../etc/passwd')).toBe(false);
    });
});

describe.skipIf(process.platform !== 'win32')('on Windows', () => {
    test('a path on another drive is outside, one in another case or with forward slashes inside', () => {
        expect(isWithin('C:\\project', 'D:\\project\\file')).toBe(false);
        expect(isBelow('C:\\Project', 'c:\\project\\src')).toBe(true);
        expect(isBelow('C:\\project', 'C:/project/..cache/file')).toBe(true);
        expect(climbsOut(win32.join('..', 'other'))).toBe(true);
    });
});
