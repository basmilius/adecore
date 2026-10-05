import { useEffect, useRef } from 'react';
import { isInFloatingLayer } from '@adecore/ui';

/*
 * Catches the click that follows a press in a popup, menu or dialog. When a popup closes on that
 * press, the browser lands the click on whatever lies under the pointer, which is not something the
 * person clicked. The returned check is true once for such a click.
 */
export function usePopupPress(): () => boolean {
    const pressed = useRef(false);

    useEffect(() => {
        const press = (e: PointerEvent): void => {
            pressed.current = isInFloatingLayer(e.target);
        };
        document.addEventListener('pointerdown', press, true);
        return () => {
            document.removeEventListener('pointerdown', press, true);
        };
    }, []);

    return () => {
        const was = pressed.current;
        pressed.current = false;
        return was;
    };
}
