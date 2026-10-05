import { expect, test } from 'bun:test';
import { cliEnvironment } from './environment.ts';

test('an app started from a Ruimte terminal hands its CLIs nothing of that session', () => {
    const env = cliEnvironment({
        HOME: '/home/person',
        PATH: '/usr/bin',
        RUIMTE_HOOK_URL: 'http://127.0.0.1:4210/hooks',
        RUIMTE_HOOK_TOKEN: 'secret',
        RUIMTE_HOOK_LATER: 'x',
        RUIMTE_CONTEXT_URL: 'http://127.0.0.1:4210/context',
        RUIMTE_CONTEXT_TOKEN: 'secret',
        RUIMTE_SESSION_ID: 'node-1',
        RUIMTE_HOME: '/home/person/.ruimte',
        UNSET: undefined
    });
    expect(env).toEqual({ HOME: '/home/person', PATH: '/usr/bin', RUIMTE_HOME: '/home/person/.ruimte' });
});

test('host policies strip another session while keeping configuration and legacy protection', () => {
    expect(
        cliEnvironment(
            {
                APP_SESSION_ID: 'other',
                APP_CONTEXT_TOKEN: 'secret',
                APP_HOOK_NEW: 'secret',
                APP_HOME: '/app',
                CUSTOM_TOKEN: 'secret',
                CUSTOM_CHANNEL_MORE: 'secret',
                RUIMTE_HOOK_LATER: 'secret',
                RUIMTE_CONTEXT_FUTURE: 'secret',
                RUIMTE_SESSION_ID: 'other',
                HOME: '/home'
            },
            { sessionPrefixes: ['APP_'], variables: ['CUSTOM_TOKEN'], prefixes: ['CUSTOM_CHANNEL_'] }
        )
    ).toEqual({ APP_HOME: '/app', HOME: '/home' });
});

test('filtering does not mutate its input and cannot disable legacy protection', () => {
    const original = { RUIMTE_CONTEXT_TOKEN: 'secret', PATH: '/bin' };
    expect(cliEnvironment(original, { variables: [], prefixes: [], sessionPrefixes: [] })).toEqual({ PATH: '/bin' });
    expect(original.RUIMTE_CONTEXT_TOKEN).toBe('secret');
    expect(() => cliEnvironment({}, { sessionPrefixes: ['_'] })).toThrow('must not be empty');
});
