import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { MenuCheck, MenuSeparator } from './menu/parts.tsx';
import type { SelectItem, SelectItemAction } from './select-shared.ts';
import { Tooltip } from './Tooltip.tsx';

/* It never takes the focus, so the arrow keys stay with the list while a pointer tries one option after another. */
function RowAction({ action }: { action: SelectItemAction }) {
    return (
        <Tooltip label={action.label} name>
            <button
                type="button"
                tabIndex={-1}
                className="menu-item menu-row-action"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => action.run()}
            >
                <Icon icon={action.icon} size={14} />
            </button>
        </Tooltip>
    );
}

/*
 * What a row stands in. One with an action is a `.menu-row`, as a `Menu.Row` is: the option and the
 * button beside it are two items that light up together. The button is no option, so it sits outside
 * the one it acts on and a press on it picks nothing.
 */
export function RowFrame<T extends string>({ item, children }: { item: SelectItem<T>; children: ReactNode }) {
    const row =
        item.action === undefined ? (
            children
        ) : (
            <div role="presentation" className="menu-row">
                {children}
                <RowAction action={item.action} />
            </div>
        );

    if (!item.separatorAfter) {
        return row;
    }

    return (
        <>
            {row}
            <MenuSeparator />
        </>
    );
}

/* The check, icon and text of a row; `text` is the element that carries the label, which Base UI wants to know. */
export function RowContent<T extends string>({ item, picked, text }: { item: SelectItem<T>; picked: boolean; text: ReactNode }) {
    return (
        <>
            <MenuCheck kind="radio" checked={picked} />
            {item.icon && <span className="flex h-lh shrink-0 items-center">{item.icon}</span>}
            <span className="flex min-w-0 flex-col">
                {text}
                {item.description && <span className="text-xs text-text-faint">{item.description}</span>}
            </span>
        </>
    );
}
