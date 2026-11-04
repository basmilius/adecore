import { describe, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import { homeFolder } from './home-folder.ts';

describe('homeFolder', () => {
    test('reads HOME on a POSIX platform', () => {
        expect(homeFolder({ HOME: '/home/ada', USERPROFILE: 'C:\\Users\\other' }, 'linux')).toBe('/home/ada');
    });

    test('reads USERPROFILE on Windows, where HOME may be a Git Bash path', () => {
        expect(homeFolder({ HOME: '/c/Users/ada', USERPROFILE: 'C:\\Users\\ada' }, 'win32')).toBe('C:\\Users\\ada');
    });

    test('falls back on the home of the process when the variable is missing or empty', () => {
        expect(homeFolder({ HOME: '' }, 'darwin')).toBe(homedir());
        expect(homeFolder({ HOME: '/c/Users/ada' }, 'win32')).toBe(homedir());
    });
});
