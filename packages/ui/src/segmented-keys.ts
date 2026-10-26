import type { SegmentedOption } from './Segmented.tsx';

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// The index of the one tab stop: the picked option, or the first that can be picked when that one is missing or disabled.
export function segmentedStop<T extends string>(options: readonly SegmentedOption<T>[], value: T): number {
    const picked = options.findIndex((option) => option.id === value);

    return picked !== -1 && !options[picked]!.disabled ? picked : options.findIndex((option) => !option.disabled);
}

// The index a key moves to from `index`, passing over disabled options and around the ends; `null` when the key moves nothing.
export function segmentedTarget(options: readonly SegmentedOption<string>[], index: number, key: string): number | null {
    const nearest = (from: number, step: number): number | null => {
        for (let offset = 0; offset < options.length; offset++) {
            const candidate = (((from + step * offset) % options.length) + options.length) % options.length;

            if (!options[candidate]!.disabled) {
                return candidate;
            }
        }

        return null;
    };

    if (key in STEPS) {
        return nearest(index + STEPS[key]!, STEPS[key]!);
    }

    if (key === 'Home') {
        return nearest(0, 1);
    }

    if (key === 'End') {
        return nearest(options.length - 1, -1);
    }

    return null;
}
