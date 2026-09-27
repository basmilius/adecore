// Every popup, menu, tooltip and dialog of the library is portaled; these are the layers it draws them on.
const FLOATING_LAYERS = '[data-base-ui-portal], .tooltip-popup, .dialog-popup, .dialog-backdrop';

/* Whether an event landed in a popup rather than on the surface under it, which a canvas-like surface must not take as a click of its own. */
export const isInFloatingLayer = (target: EventTarget | null): boolean => target instanceof Element && target.closest(FLOATING_LAYERS) !== null;

/* A popup is portaled out of its trigger's element but not out of React's tree, so its events still bubble to that trigger. */
export const cameThroughPortal = (event: { currentTarget: Element; target: EventTarget }): boolean =>
    !(event.target instanceof Node && event.currentTarget.contains(event.target));
