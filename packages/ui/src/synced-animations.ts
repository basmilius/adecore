/* `spinner-hop` is the library's; an app adds its own with `syncAnimations`. */
const names = new Set<string>(['spinner-hop']);

let started = false;

/* What an `animationstart` hands the listener: the target is an element, which a test fakes without a DOM. */
interface AnimationStart {
    readonly animationName: string;
    readonly target: EventTarget | null;
}

const isCssAnimation = (animation: Animation): animation is CSSAnimation => 'animationName' in animation;

/* Adds looping animations by their `@keyframes` name. A one-off animation does not belong here: on the
   document's clock it would start long over. Neither does one that restarts on purpose, such as a caret's blink. */
export function syncAnimations(added: readonly string[]): void {
    for (const name of added) {
        names.add(name);
    }
}

/* Moves a listed animation that just started onto the document timeline's zero. Its own delay still
   applies, so the dots of a spinner keep their thirds. */
export function alignAnimation({ animationName, target }: AnimationStart): void {
    if (!names.has(animationName) || target === null || !('getAnimations' in target)) {
        return;
    }

    for (const animation of (target as Element).getAnimations()) {
        if (isCssAnimation(animation) && animation.animationName === animationName && animation.startTime !== 0) {
            animation.startTime = 0;
        }
    }
}

/* A CSS animation starts when its element is styled, so two spinners mounted a moment apart take their
   steps at other moments, and every step of each is a frame of its own. On one clock the steps of every
   listed animation fall in the same frames, whatever mounted when.

   On `animationstart` and not on mount, so nothing reads styles in a commit; the first step may show in
   its own phase before it moves onto the grid. `UIProvider` starts it; a second call does nothing. */
export function startSyncedAnimations(): void {
    if (started) {
        return;
    }

    started = true;
    document.addEventListener('animationstart', alignAnimation, { capture: true, passive: true });
}
