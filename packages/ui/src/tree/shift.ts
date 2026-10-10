export const SHIFT_PROPERTY = '--adecore-tree-shift';

const LINE_WIDTH = 16;

const MIN_THUMB = 24;

export function clampShift(value: number, max: number): number {
    return Math.min(Math.max(value, 0), Math.max(max, 0));
}

export function shiftNeed(textRight: number, limit: number, shift: number): number {
    return Math.max(0, Math.ceil(textRight + shift - limit));
}

export function maxShift(needs: readonly number[]): number {
    return needs.reduce((max, need) => Math.max(max, need), 0);
}

export interface WheelStep {
    readonly deltaX: number;
    readonly deltaY: number;
    readonly deltaMode: number;
    readonly shiftKey: boolean;
}

export function sidewaysDelta(step: WheelStep, pageWidth: number): number {
    const swapped = step.shiftKey && step.deltaX === 0;
    const sideways = swapped ? step.deltaY : step.deltaX;
    const across = swapped ? 0 : step.deltaY;
    if (sideways === 0 || Math.abs(sideways) <= Math.abs(across)) {
        return 0;
    }
    if (step.deltaMode === 1) {
        return sideways * LINE_WIDTH;
    }
    if (step.deltaMode === 2) {
        return sideways * pageWidth;
    }
    return sideways;
}

export function shiftThumb(shift: number, max: number, track: number, view: number): { left: number; width: number } {
    if (max <= 0 || track <= 0) {
        return { left: 0, width: Math.max(track, 0) };
    }
    const width = Math.min(track, Math.max(MIN_THUMB, Math.round((track * view) / (view + max))));
    return { left: Math.round(((track - width) * clampShift(shift, max)) / max), width };
}
