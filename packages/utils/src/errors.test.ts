import { describe, expect, test } from 'bun:test';
import { asError, describeError, hasErrorCode, isNotFound } from './errors.ts';

describe('hasErrorCode', () => {
    test('matches the code of an error against any of the codes given', () => {
        const error = Object.assign(new Error('gone'), { code: 'ENOENT' });

        expect(hasErrorCode(error, 'ENOENT')).toBe(true);
        expect(hasErrorCode(error, 'EXDEV', 'ENOENT')).toBe(true);
        expect(hasErrorCode(error, 'EXDEV')).toBe(false);
        expect(isNotFound(error)).toBe(true);
    });

    test('is false for a value without a code', () => {
        expect(hasErrorCode(new Error('plain'), 'ENOENT')).toBe(false);
        expect(hasErrorCode(null, 'ENOENT')).toBe(false);
        expect(hasErrorCode('ENOENT', 'ENOENT')).toBe(false);
    });
});

describe('asError', () => {
    test('keeps an error and wraps anything else', () => {
        const error = new TypeError('bad');

        expect(asError(error)).toBe(error);
        expect(asError('text').message).toBe('text');
    });
});

describe('describeError', () => {
    test('prints the message only', () => {
        expect(describeError(new Error('Unknown command: serv'), false)).toBe('Unknown command: serv');
    });

    test('prints the stack with the debug variable', () => {
        const error = new Error('boom');
        error.stack = 'Error: boom\n    at main (/$bunfs/root/app:1:1)';
        expect(describeError(error, true)).toBe(error.stack);
    });

    test('falls back to the name when there is no message', () => {
        expect(describeError(new TypeError(''), false)).toBe('TypeError');
    });

    test('prints what was thrown when it is no error', () => {
        expect(describeError('a string', false)).toBe('a string');
        expect(describeError(42, true)).toBe('42');
    });
});
