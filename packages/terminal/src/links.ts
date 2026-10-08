import { WebLinksAddon } from '@xterm/addon-web-links';
import type { IBufferRange, Terminal } from '@xterm/xterm';

export interface TerminalLinkBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function linkLineBounds(
    range: IBufferRange,
    grid: { cols: number; rows: number; viewportY: number },
    screen: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
    pointerY: number
): TerminalLinkBounds | null {
    if (screen.width <= 0 || screen.height <= 0) {
        return null;
    }
    const cellWidth = screen.width / grid.cols;
    const cellHeight = screen.height / grid.rows;
    const row = Math.max(range.start.y, Math.min(range.end.y, grid.viewportY + Math.floor((pointerY - screen.top) / cellHeight) + 1));
    const start = row === range.start.y ? range.start.x : 1;
    const end = row === range.end.y ? range.end.x : grid.cols;
    return {
        x: screen.left + (start - 1) * cellWidth,
        y: screen.top + (row - grid.viewportY - 1) * cellHeight,
        width: (end - start + 1) * cellWidth,
        height: cellHeight
    };
}

interface TerminalLinks {
    onOpenLink?(uri: string, event: MouseEvent): void;
    onLinkHover?(uri: string | null, bounds: TerminalLinkBounds | null): void;
}

export function bindTerminalLinks(term: Terminal, callbacks: () => TerminalLinks): () => void {
    const element = term.element!;
    let press: { x: number; y: number } | null = null;
    const rememberPress = (event: MouseEvent): void => {
        press = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const cancelPress = (): void => {
        press = null;
    };
    const activate = (event: MouseEvent, uri: string): void => {
        const start = press;
        press = null;
        // xterm 6 activates on mouseup, including selection drags and non-primary buttons.
        if (!start || event.button !== 0 || event.defaultPrevented || term.hasSelection() || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 3) {
            return;
        }
        // OSC 8 targets and detected URLs share the same web-only boundary.
        if (!/^https?:\/\//i.test(uri) || !URL.canParse(uri)) {
            return;
        }
        const open = callbacks().onOpenLink;
        if (open) {
            open(uri, event);
        } else {
            // Shells that deny new windows need the target in the initial request.
            window.open(uri, '_blank', 'noopener,noreferrer');
        }
    };
    const hover = (event: MouseEvent, uri: string, range: IBufferRange): void => {
        const screen = element.querySelector('.xterm-screen')?.getBoundingClientRect();
        // Screen bounds include canvas zoom; xterm ranges are one-based buffer coordinates, including scrollback.
        const bounds = screen
            ? linkLineBounds(range, { cols: term.cols, rows: term.rows, viewportY: term.buffer.active.viewportY }, screen, event.clientY)
            : null;
        callbacks().onLinkHover?.(bounds ? uri : null, bounds);
    };
    const leave = (): void => callbacks().onLinkHover?.(null, null);
    const previous = term.options.linkHandler;
    term.options.linkHandler = { activate, hover, leave, allowNonHttpProtocols: false };
    const addon = new WebLinksAddon(activate, { hover, leave });
    term.loadAddon(addon);
    element.addEventListener('mousedown', rememberPress, true);
    element.addEventListener('pointercancel', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
    return () => {
        element.removeEventListener('mousedown', rememberPress, true);
        element.removeEventListener('pointercancel', cancelPress);
        element.removeEventListener('mouseleave', cancelPress);
        term.options.linkHandler = previous;
        addon.dispose();
    };
}
