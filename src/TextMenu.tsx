import { useRef, useState, type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Copy, Scan } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copyText } from './clipboard.ts';
import { Icon } from './Icon.tsx';
import { Kbd } from './Kbd.tsx';
import { ContextMenuRoot, ContextMenuTrigger, MenuItem, MenuPopup, MenuSeparator } from './menu/parts.tsx';
import { isApplePlatform } from './platform.ts';
import { selectAllWithin, selectionWithin } from './selection.ts';
import { EDIT_SHORTCUTS, matchesShortcut } from './shortcut.ts';

export type TextMenuProps = Omit<ComponentProps<'div'>, 'ref'> & {
    /* What the surface itself can be asked, under a line of their own: `ContextMenu.Item`s. */
    items?: ReactNode;
};

/*
 * A block of text and the menu that belongs to it: Copy for what is selected inside it, Select all
 * for the whole of it, on Cmd+A as well. Anywhere text can be selected a right-click has to offer
 * to copy it, and an app that draws every menu itself offers nothing at all without one of these.
 */
export function TextMenu({ children, items, ...rest }: TextMenuProps) {
    const { t } = useTranslation('ui');
    const host = useRef<HTMLDivElement>(null);
    // Read when the menu opens: a selection made after that is not the one the click was about.
    const [selection, setSelection] = useState('');

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        if (!matchesShortcut(EDIT_SHORTCUTS.selectAll, event, isApplePlatform())) {
            return;
        }
        event.preventDefault();
        selectAllWithin(host.current);
    };

    return (
        <ContextMenuRoot onOpenChange={(open) => setSelection(open ? selectionWithin(host.current) : '')}>
            <ContextMenuTrigger {...rest} ref={host} onKeyDown={onKeyDown}>
                {children}
            </ContextMenuTrigger>
            <MenuPopup>
                <MenuItem disabled={selection === ''} onClick={() => copyText(selection)}>
                    <Icon icon={Copy} size={14} /> {t('action.copy')} <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                </MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => selectAllWithin(host.current)}>
                    <Icon icon={Scan} size={14} /> {t('action.selectAll')} <Kbd shortcut={EDIT_SHORTCUTS.selectAll} />
                </MenuItem>
                {items !== undefined && (
                    <>
                        <MenuSeparator />
                        {items}
                    </>
                )}
            </MenuPopup>
        </ContextMenuRoot>
    );
}
