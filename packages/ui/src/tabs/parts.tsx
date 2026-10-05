import { Children, createContext, isValidElement, useContext, useLayoutEffect, useRef, useState, type ComponentProps, type ReactElement } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs';
import { useRender } from '@base-ui-components/react/use-render';
import { withClass } from '../class-name.ts';
import { formatNumber } from '../format/number.ts';
import { IconButton } from '../IconButton.tsx';
import { MenuItem, MenuPopup, MenuRoot, MenuTrigger } from '../menu/parts.tsx';
import { shownTabs } from './overflow.ts';

export type TabsValue = BaseTabs.Tab.Value;

interface Selection {
    value: TabsValue;
    select(value: TabsValue): void;
}

const SelectionContext = createContext<Selection>({ value: undefined, select: () => {} });

/* Whether a part is drawn in the menu of tabs that do not fit, where a count goes to the end of its row. */
const InMenuContext = createContext(false);

/* The underline sits over the strip's border rather than above it, without a negative margin that would make the strip scroll. */
const TAB =
    'relative flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-text-muted hover:text-text data-[active]:text-text data-[disabled]:opacity-50 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 data-[active]:after:bg-text';

export type TabsRootProps = Omit<ComponentProps<typeof BaseTabs.Root>, 'onValueChange'> & {
    onValueChange?(value: TabsValue): void;
};

/* Holds the picked tab itself, uncontrolled or not, so a tab picked from the menu of the strip changes it too. */
export function TabsRoot({ value, defaultValue = 0, onValueChange, ...props }: TabsRootProps) {
    const [own, setOwn] = useState<TabsValue>(defaultValue);
    const current = value === undefined ? own : value;
    const select = (next: TabsValue): void => {
        if (value === undefined) {
            setOwn(next);
        }
        onValueChange?.(next);
    };
    return (
        <SelectionContext value={{ value: current, select }}>
            <BaseTabs.Root value={current} onValueChange={(next) => select(next)} {...props} />
        </SelectionContext>
    );
}

export type TabsListProps = Omit<ComponentProps<typeof BaseTabs.List>, 'className'> & {
    /* On the strip, which runs the width of the pane; padding here insets the tabs from its edges. */
    className?: string;
};

const sameIndices = (left: readonly number[] | null, right: readonly number[]): boolean =>
    left !== null && left.length === right.length && left.every((index, at) => index === right[at]);

/*
 * The tabs that fit, and a menu at the end of the strip with the ones that do not. Every tab is measured
 * in a row nobody sees, so the strip knows what fits before it draws. The tabs are the direct children,
 * since the menu repeats what a tab holds.
 */
export function TabsList({ className, children, ...props }: TabsListProps) {
    const { t } = useTranslation('ui');
    const { value, select } = useContext(SelectionContext);
    const strip = useRef<HTMLDivElement>(null);
    const measure = useRef<HTMLDivElement>(null);
    // Null until the first measure, which runs before the first paint.
    const [shown, setShown] = useState<number[] | null>(null);
    const tabs = Children.toArray(children).filter(
        (child): child is ReactElement<ComponentProps<typeof TabsTab>> => isValidElement(child) && child.type === TabsTab
    );
    const picked = tabs.findIndex((tab) => tab.props.value === value);

    useLayoutEffect(() => {
        const host = strip.current;
        const row = measure.current;
        if (!host || !row) {
            return;
        }
        const fit = (): void => {
            const style = getComputedStyle(host);
            const room = host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const cells = [...row.children].map((cell) => cell.getBoundingClientRect().width);
            const more = cells.pop() ?? 0;
            const next = shownTabs(cells, room, parseFloat(getComputedStyle(row).columnGap) || 0, more, picked);
            setShown((current) => (sameIndices(current, next) ? current : next));
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(host);
        observer.observe(row);
        return () => observer.disconnect();
    });

    const visible = shown === null ? tabs : shown.map((index) => tabs[index]!);
    const hidden = shown === null ? [] : tabs.filter((_, index) => !shown.includes(index));

    return (
        <div ref={strip} className={clsx('relative flex items-center gap-4 border-b border-border', className)}>
            <BaseTabs.List className="flex min-w-0 items-end gap-4" {...props}>
                {visible}
            </BaseTabs.List>
            {hidden.length > 0 && (
                <MenuRoot>
                    <IconButton icon={ChevronDown} size="xs" label={t('tabs.more')} className="ml-auto" render={<MenuTrigger />} />
                    <MenuPopup align="end" className="min-w-48">
                        <InMenuContext value>
                            {hidden.map((tab) => (
                                <MenuItem key={tab.key} disabled={tab.props.disabled} onClick={() => select(tab.props.value)}>
                                    {tab.props.children}
                                </MenuItem>
                            ))}
                        </InMenuContext>
                    </MenuPopup>
                </MenuRoot>
            )}
            <div ref={measure} aria-hidden inert className="pointer-events-none invisible absolute top-0 left-0 flex gap-4">
                {tabs.map((tab) => (
                    <span key={tab.key} className={TAB}>
                        {tab.props.children}
                    </span>
                ))}
                <span className="icon-btn icon-btn-xs" />
            </div>
        </div>
    );
}

export function TabsTab({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
    return <BaseTabs.Tab className={withClass(TAB, className)} {...props} />;
}

export const TabsPanel = BaseTabs.Panel;

export type TabsCountProps = Omit<useRender.ComponentProps<'span'>, 'children'> & {
    value: number;
};

/* How much a tab holds, after its label. Nothing at zero: an empty view needs no number to say so. */
export function TabsCount({ value, render, className, ref, ...props }: TabsCountProps) {
    const inMenu = useContext(InMenuContext);
    const element = useRender({
        render,
        ref,
        defaultTagName: 'span',
        props: {
            ...props,
            children: formatNumber(value),
            className: clsx('rounded-full bg-surface-sunken px-1.5 text-xs text-text-muted tabular-nums', inMenu && 'ml-auto', className)
        }
    });
    return value === 0 ? null : element;
}
