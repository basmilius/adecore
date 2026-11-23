import { expect, test } from 'bun:test';
import settingsCapture from '../chat/fixtures/claude-2.1.322-get-settings.json';
import { inProcess, type FakeCli } from '../testing/fake-cli.ts';
import { createClaudeProvider } from './claude-provider.ts';

// The answer Claude Code 2.1.322 gave with caps in its project and flag settings: project `high`, flags `xhigh`.
const CAPPED = settingsCapture.capped.frames.find((entry) => entry.dir === 'out')?.frame.response?.response;

/* Answers the probe's handshake, its `get_settings` with the given answer or a refusal, and its `get_usage`. */
function fakeProbe(settings: unknown | 'refuse'): FakeCli {
    return (io) => ({
        onLine: (line) => {
            const frame = JSON.parse(line) as { request_id: string; request: { subtype: string } };
            const subtype = frame.request.subtype;

            if (subtype === 'get_settings' && settings === 'refuse') {
                io.out({ type: 'control_response', response: { subtype: 'error', request_id: frame.request_id, error: 'Unknown subtype' } });

                return;
            }

            const answer = subtype === 'get_settings' ? settings : subtype === 'get_usage' ? { subscription_type: 'max', rate_limits_available: false } : {};

            io.out({ type: 'control_response', response: { subtype: 'success', request_id: frame.request_id, response: answer } });
        }
    });
}

function effortLabels(provider: ReturnType<typeof createClaudeProvider>, slug: string): string[] {
    const descriptor = provider.catalog
        .list()
        .find((model) => model.slug === slug)
        ?.options.find((option) => option.id === 'effort');

    return descriptor?.type === 'select' ? descriptor.choices.map((choice) => choice.label) : [];
}

test('the caps the limits probe reads label the efforts above them and tell the registry', async () => {
    const provider = createClaudeProvider({ probeSpawn: inProcess(fakeProbe(CAPPED)).spawn });
    let changes = 0;
    provider.onChange?.(() => changes++);

    const reading = await provider.probeLimits?.(['claude'], {});

    expect(reading).toEqual({ unavailable: { reason: 'no-subscription', message: null } });
    expect(changes).toBe(1);
    expect(effortLabels(provider, 'claude-fable-5-2')).toEqual(['Low', 'Medium', 'High', 'Extra high (capped to High)', 'Max (capped to High)', 'Ultrathink']);
    expect(effortLabels(provider, 'claude-sonnet-5-5')).toEqual([
        'Low',
        'Medium',
        'High (capped to Medium)',
        'Extra high (capped to Medium)',
        'Max (capped to Medium)',
        'Ultrathink'
    ]);
});

test('a Claude Code that refuses get_settings leaves the list alone and still reports its usage', async () => {
    const provider = createClaudeProvider({ probeSpawn: inProcess(fakeProbe('refuse')).spawn });
    const before = provider.catalog.list();
    let changes = 0;
    provider.onChange?.(() => changes++);

    const reading = await provider.probeLimits?.(['claude'], {});

    expect(reading).toEqual({ unavailable: { reason: 'no-subscription', message: null } });
    expect(changes).toBe(0);
    expect(provider.catalog.list()).toEqual(before);
});
