import { describe, expect, test } from 'bun:test';
import { alignAnimation, syncAnimations } from './synced-animations.ts';

interface FakeAnimation {
    animationName?: string;
    startTime: number | null;
}

const elementWith = (...animations: FakeAnimation[]) => ({ getAnimations: () => animations }) as unknown as EventTarget;

describe('a looping animation on the document clock', () => {
    test('starts a spinner hop at the timeline zero, whenever it mounted', () => {
        const early: FakeAnimation = { animationName: 'spinner-hop', startTime: 120 };
        const late: FakeAnimation = { animationName: 'spinner-hop', startTime: 370 };

        alignAnimation({ animationName: 'spinner-hop', target: elementWith(early) });
        alignAnimation({ animationName: 'spinner-hop', target: elementWith(late) });

        expect([early.startTime, late.startTime]).toEqual([0, 0]);
    });

    test('leaves an unlisted animation and a script animation on the same element where they started', () => {
        const fade: FakeAnimation = { animationName: 'chat-fade', startTime: 80 };
        const scripted: FakeAnimation = { startTime: 90 };
        const hop: FakeAnimation = { animationName: 'spinner-hop', startTime: 100 };

        alignAnimation({ animationName: 'chat-fade', target: elementWith(fade) });
        alignAnimation({ animationName: 'spinner-hop', target: elementWith(fade, scripted, hop) });

        expect([fade.startTime, scripted.startTime, hop.startTime]).toEqual([80, 90, 0]);
    });

    test('takes an app animation once it is added by name', () => {
        const pulse: FakeAnimation = { animationName: 'app-pulse', startTime: 40 };

        alignAnimation({ animationName: 'app-pulse', target: elementWith(pulse) });
        expect(pulse.startTime).toBe(40);

        syncAnimations(['app-pulse']);
        alignAnimation({ animationName: 'app-pulse', target: elementWith(pulse) });
        expect(pulse.startTime).toBe(0);
    });
});
