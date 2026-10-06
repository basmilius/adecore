import { describe, expect, test } from 'bun:test';
import { VISUAL_LIMITS, type ChatVisual } from '@adecore/agent-contracts/visual';
import { clampVisualHeight, initialVisualHeight, rememberVisualHeight } from './visual-height';

// The cache lives as long as the module, so every test draws visuals of its own.
function visual(id: string, fields: Partial<ChatVisual> = {}): ChatVisual {
    return { id, title: id, at: 0, maxHeight: 1200, size: 1, ...fields };
}

describe('the height of a visual frame', () => {
    test('starts modest when nothing measured the page, and never taller than the page may grow', () => {
        expect(initialVisualHeight(visual('plain'), 640)).toBe(240);
        expect(initialVisualHeight(visual('short', { maxHeight: 160 }), 640)).toBe(160);
    });

    test('starts at what the host measured nearby', () => {
        expect(
            initialVisualHeight(
                visual('measured', {
                    heights: [
                        [560, 300],
                        [720, 420]
                    ]
                }),
                640
            )
        ).toBe(420);
    });

    test('starts at what a frame that wide reported before, over what the host measured', () => {
        const remembered = visual('remembered', { heights: [[640, 300]] });
        rememberVisualHeight('remembered', 640, 512);
        expect(initialVisualHeight(remembered, 640)).toBe(512);
        expect(initialVisualHeight(remembered, 639.6)).toBe(512);
        expect(initialVisualHeight(remembered, 800)).toBe(300);
    });

    test('a later report at the same width replaces the earlier one', () => {
        rememberVisualHeight('again', 480, 200);
        rememberVisualHeight('again', 480, 260);
        expect(initialVisualHeight(visual('again'), 480)).toBe(260);
    });

    test('forgets the oldest reports once it holds plenty', () => {
        rememberVisualHeight('first', 400, 333);
        for (let i = 0; i < 500; i++) {
            rememberVisualHeight(`filler-${i}`, 400, 100);
        }
        expect(initialVisualHeight(visual('first'), 400)).toBe(240);
        expect(initialVisualHeight(visual('filler-499'), 400)).toBe(100);
    });

    test('holds a report to the maximum of the visual and the limits, in whole pixels', () => {
        expect(clampVisualHeight({ maxHeight: 900 }, 300.2)).toBe(301);
        expect(clampVisualHeight({ maxHeight: 900 }, 4000)).toBe(900);
        expect(clampVisualHeight({ maxHeight: 5000 }, 4000)).toBe(VISUAL_LIMITS.maxHeight);
        expect(clampVisualHeight({ maxHeight: 900 }, 0)).toBe(VISUAL_LIMITS.minHeight);
    });
});
