import type { EffortStep } from './logic/effort';

type Stepper = (step: EffortStep) => void;

/*
 * A command outside the composer, such as a menu row or a shortcut of the app, steps the reasoning effort
 * of a chat whose composer is on screen. Keyed with the scope's `keyOf`, like `sendFromComposer`. One chat can
 * have two composers on screen; the one that came last steps, and the one before takes over when it goes.
 */
const steppers = new Map<string, Stepper[]>();

export function registerEffortStepper(key: string, stepper: Stepper): () => void {
    steppers.set(key, [...(steppers.get(key) ?? []), stepper]);

    return () => {
        const left = (steppers.get(key) ?? []).filter((entry) => entry !== stepper);

        if (left.length > 0) {
            steppers.set(key, left);
        } else {
            steppers.delete(key);
        }
    };
}

/* False when that chat has no composer on screen. At either end of the model's efforts the composer says so and nothing changes. */
export function stepEffortFromComposer(key: string, step: EffortStep): boolean {
    const stepper = steppers.get(key)?.at(-1);

    if (stepper === undefined) {
        return false;
    }

    stepper(step);

    return true;
}
