import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { ServerFrameSchema, parseServerFrame } from './envelope';

describe('server frame parsing', () => {
    it('keeps reply precedence when future event fields accompany a reply', () => {
        const input = { id: 'reply', ok: true, result: { value: 1 }, type: 'event', event: 'future', payload: 'event' };
        const parsed = parseServerFrame(input);

        expect(parsed).toEqual({ ok: true, value: { id: 'reply', ok: true, result: input.result } });

        if (parsed.ok && 'result' in parsed.value) {
            expect(parsed.value.result).toBe(input.result);
        }
    });

    it('parses replies without reading unrelated event fields', () => {
        const input = { id: 'reply', ok: true, result: { value: 1 } } as const;
        Object.defineProperty(input, 'type', {
            get() {
                throw new Error('Reply parsing must not read event fields');
            }
        });

        expect(ServerFrameSchema.safeParse(input).success).toBe(true);
        expect(parseServerFrame(input)).toEqual({ ok: true, value: input });
    });

    it('strips future envelope fields while preserving the event payload', () => {
        const payload = { future: [1, null, 'value'] };

        for (const extra of [{}, { ok: null }, { ok: true }, { ok: false }, { ok: 'true' }]) {
            const parsed = parseServerFrame({ type: 'event', event: 'future', payload, extra: 1, ...extra });

            expect(parsed).toEqual({ ok: true, value: { type: 'event', event: 'future', payload } });

            if (parsed.ok && 'event' in parsed.value) {
                expect(parsed.value.payload).toBe(payload);
            }
        }
    });

    it('retains the wire schema diagnostics for malformed envelopes', () => {
        for (const input of [null, [], 'event', {}, { type: 'event', event: '' }, { type: 'event', event: 1, payload: null }]) {
            const expected = ServerFrameSchema.safeParse(input);

            expect(expected.success).toBe(false);

            if (!expected.success) {
                expect(parseServerFrame(input)).toEqual({ ok: false, message: z.prettifyError(expected.error) });
            }
        }
    });
});
