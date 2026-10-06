import { createElement, useLayoutEffect, type ComponentProps } from 'react';

// One attribute serves every open popup, so it stays until the last one closes.
const open = new Set<symbol>();

/*
 * Marks the root with `data-popup-open` while a popup is open, which the theme reads to turn the
 * window's drag regions off. An attribute on the root instead of `:root:has(...)`, which made the
 * browser restyle the whole page on every DOM insertion.
 */
function usePopupLayer(isOpen: boolean): void {
    useLayoutEffect(() => {
        if (!isOpen) {
            return;
        }
        const self = Symbol('popup');
        open.add(self);
        document.documentElement.setAttribute('data-popup-open', '');
        return () => {
            open.delete(self);
            if (open.size === 0) {
                document.documentElement.removeAttribute('data-popup-open');
            }
        };
    }, [isOpen]);
}

function LayerPositioner({ open: isOpen, ...props }: ComponentProps<'div'> & { readonly open: boolean }) {
    usePopupLayer(isOpen);
    return createElement('div', props);
}

/* The `render` of a popup's positioner, which knows whether the popup is open and so marks the root for as long as it is. */
export const renderPositioner = (props: ComponentProps<'div'>, state: { open: boolean }) => createElement(LayerPositioner, { ...props, open: state.open });
