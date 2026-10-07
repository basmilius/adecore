import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';
import { isApplePlatform } from './platform.ts';
import { formatShortcut, shortcutParts, type Shortcut } from './shortcut.ts';

/* A shortcut chip on the surface it sits on: in a tooltip, in a palette's footer, in a line of help. */
const INLINE_KBD = 'rounded-sm bg-surface-sunken px-[5px] py-px font-sans text-xs/[inherit] text-text-muted';

/* One key, drawn as a cap. A settings page prints a shortcut key by key, so a gesture can stand beside it. */
const KEY_CAP = 'inline-grid place-items-center rounded-md border border-b-2 border-border-strong bg-surface-hover bg-clip-padding font-sans text-text';

/* `sm` fits inside a small field, as the hint of the key that focuses it. */
const KEY_CAP_SIZES = { md: 'h-6 min-w-6 px-1.5 text-xs', sm: 'h-5 min-w-5 px-1 text-2xs' } as const;

export interface KbdProps {
    /* Printed the way this platform writes it. Without one, the children are printed as they are (`↑`, `Esc`). */
    shortcut?: Shortcut;
    children?: ReactNode;
    /*
     * Where the shortcut is printed. In a menu row the `.menu-item kbd` rule dresses it, as the
     * quiet hint at the end of the row; anywhere else it is a chip on the surface it sits on.
     */
    variant?: 'menu' | 'inline';
    className?: string;
    ref?: Ref<HTMLElement>;
}

/* A shortcut as this platform prints it: `⌘K` on macOS, `Ctrl+K` elsewhere. */
export function Kbd({ shortcut, children, variant = 'menu', className, ref }: KbdProps) {
    return (
        <kbd ref={ref} className={clsx(variant === 'inline' && INLINE_KBD, className)}>
            {shortcut !== undefined ? formatShortcut(shortcut, isApplePlatform()) : children}
        </kbd>
    );
}

export interface KeyCapProps {
    children: ReactNode;
    size?: 'md' | 'sm';
    className?: string;
    ref?: Ref<HTMLElement>;
}

export function KeyCap({ children, size = 'md', className, ref }: KeyCapProps) {
    return (
        <kbd ref={ref} className={clsx(KEY_CAP, KEY_CAP_SIZES[size], className)}>
            {children}
        </kbd>
    );
}

export interface KeysProps {
    shortcut: Shortcut;
    /* The pointer gesture the keys go with, such as "drag", as one more cap. */
    then?: string;
    size?: 'md' | 'sm';
    className?: string;
    ref?: Ref<HTMLSpanElement>;
}

/* A shortcut as one cap per key, `⌘` and `K`, plus the pointer gesture it goes with. */
export function Keys({ shortcut, then, size = 'md', className, ref }: KeysProps) {
    const parts = [...shortcutParts(shortcut, isApplePlatform()), ...(then ? [then] : [])];
    return (
        <span ref={ref} className={clsx('flex items-center', size === 'sm' ? 'gap-0.5' : 'gap-1', className)}>
            {parts.map((part, index) => (
                <KeyCap key={`${part}-${index}`} size={size}>
                    {part}
                </KeyCap>
            ))}
        </span>
    );
}
