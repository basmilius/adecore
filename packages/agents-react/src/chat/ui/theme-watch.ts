/* The attributes of the root and the body an app switches its theme, its accent or its palette with. */
const THEME_ATTRIBUTES = ['class', 'style', 'data-theme'];

/*
 * Calls `changed` at most once a frame after the root or body of `owner` changes a theme attribute. An app
 * that rewrites its palette through a stylesheet touches the root's `style` as well, as the terminal expects.
 * Any change counts, also one that leaves every token alone, so a caller compares what it reads with what it drew.
 */
export function watchTheme(owner: Document, changed: () => void): () => void {
    const view = owner.defaultView ?? window;
    let frame = 0;

    const schedule = (): void => {
        if (frame === 0) {
            frame = view.requestAnimationFrame(() => {
                frame = 0;
                changed();
            });
        }
    };

    const observer = new view.MutationObserver(schedule);

    for (const root of [owner.documentElement, owner.body]) {
        if (root !== null) {
            observer.observe(root, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
        }
    }

    return () => {
        observer.disconnect();

        if (frame !== 0) {
            view.cancelAnimationFrame(frame);
            frame = 0;
        }
    };
}
