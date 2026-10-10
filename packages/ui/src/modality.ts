type Modality = 'keyboard' | 'pointer';

let current: Modality | null = null;
let started = false;

const set = (modality: Modality): void => {
    if (current === modality) {
        return;
    }
    current = modality;
    document.documentElement.dataset.modality = modality;
};

/* Which device the app was last driven with, as `data-modality` on the root. `:focus-visible` alone
   cannot tell: focus a script moves (Base UI's hovered menu item) keeps matching it once a single
   keystroke anywhere, a terminal included, raised the browser's keyboard flag. `UIProvider` starts
   it; a second call does nothing. */
export function startInputModality(): void {
    if (started) {
        return;
    }
    started = true;
    set('pointer');
    window.addEventListener(
        'keydown',
        (event) => {
            // A modifier on its own is half of a shift-click as often as it is a keystroke.
            if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Meta') {
                set('keyboard');
            }
        },
        { capture: true }
    );
    window.addEventListener('pointerdown', () => set('pointer'), { capture: true, passive: true });
    window.addEventListener('pointermove', () => set('pointer'), { capture: true, passive: true });
}
