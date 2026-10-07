import {
    Children,
    createContext,
    isValidElement,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
    type ComponentProps,
    type ReactElement,
    type ReactNode
} from 'react';
import clsx from 'clsx';
import { ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs';
import { useRender } from '@base-ui-components/react/use-render';
import { withClass } from '../class-name.ts';
import { formatNumber } from '../format/number.ts';
import { Icon } from '../Icon.tsx';
import { IconButton } from '../IconButton.tsx';
import { MenuItem, MenuPopup, MenuRoot, MenuTrigger } from '../menu/parts.tsx';
import { Pill } from '../Pill.tsx';
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

/* The button that opens the tabs that do not fit reads as one more tab, at the very end of the strip. */
const MORE = clsx(TAB, 'ml-auto data-[popup-open]:text-text');

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
    /* Drawn before the tabs, such as what they are the views of. It keeps its own width, like `end`. */
    start?: ReactNode;
    /* Drawn after the tabs, such as a button that adds one. It keeps its own width: the tabs fit in what is left. */
    end?: ReactNode;
};

const sameIndices = (left: readonly number[] | null, right: readonly number[]): boolean =>
    left !== null && left.length === right.length && left.every((index, at) => index === right[at]);

/*
 * The tabs that fit, and a menu at the end of the strip with the ones that do not. Every tab is measured
 * in a row nobody sees, so the strip knows what fits before it draws. The tabs are the direct children,
 * since the menu repeats what a tab holds.
 */
export function TabsList({ className, children, start, end, ...props }: TabsListProps) {
    const { t } = useTranslation('ui');
    const { value, select } = useContext(SelectionContext);
    const strip = useRef<HTMLDivElement>(null);
    const measure = useRef<HTMLDivElement>(null);
    const head = useRef<HTMLDivElement>(null);
    const tail = useRef<HTMLDivElement>(null);
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
            const gap = parseFloat(style.columnGap) || 0;
            const taken = [head.current, tail.current].reduce((sum, part) => (part === null ? sum : sum + part.getBoundingClientRect().width + gap), 0);
            const room = host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - taken;
            const cells = [...row.children].map((cell) => cell.getBoundingClientRect().width);
            const more = cells.pop() ?? 0;
            const next = shownTabs(cells, room, parseFloat(getComputedStyle(row).columnGap) || 0, more, picked);
            setShown((current) => (sameIndices(current, next) ? current : next));
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(host);
        observer.observe(row);
        for (const part of [head.current, tail.current]) {
            if (part !== null) {
                observer.observe(part);
            }
        }
        return () => observer.disconnect();
    });

    const visible = shown === null ? tabs : shown.map((index) => tabs[index]!);
    const hidden = shown === null ? [] : tabs.filter((_, index) => !shown.includes(index));

    return (
        <div ref={strip} className={clsx('relative flex items-center gap-4 border-b border-border', className)}>
            {start !== undefined && start !== null && (
                <div ref={head} className="flex shrink-0 items-center gap-1">
                    {start}
                </div>
            )}
            <BaseTabs.List className="flex min-w-0 items-end gap-4" {...props}>
                {visible}
            </BaseTabs.List>
            {hidden.length > 0 && (
                <MenuRoot>
                    <MenuTrigger className={MORE}>
                        {t('tabs.more')}
                        <Icon icon={ChevronDown} size={14} />
                    </MenuTrigger>
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
            {end !== undefined && end !== null && (
                <div ref={tail} className={clsx('flex shrink-0 items-center gap-1', hidden.length === 0 && 'ml-auto')}>
                    {end}
                </div>
            )}
            <div ref={measure} aria-hidden inert className="pointer-events-none invisible absolute top-0 left-0 flex gap-4">
                {tabs.map((tab) => (
                    <span key={tab.key} className={TAB}>
                        {tab.props.children}
                        {tab.props.onClose !== undefined && <span className="size-5 shrink-0" />}
                    </span>
                ))}
                <span className={MORE}>
                    {t('tabs.more')}
                    <Icon icon={ChevronDown} size={14} />
                </span>
            </div>
        </div>
    );
}

type TabProps = ComponentProps<typeof BaseTabs.Tab>;

export type TabsTabProps = TabProps & {
    /* Makes the tab closable: a close button in it, a middle click, and Delete or Backspace while the tab has focus. */
    onClose?(): void;
};

/* The close button stays out of the tab order, so a closable tab is still one stop; the keys close it from the tab itself. */
export function TabsTab({ className, onClose, children, ...props }: TabsTabProps) {
    const { t } = useTranslation('ui');

    if (onClose === undefined) {
        return (
            <BaseTabs.Tab className={withClass(TAB, className)} {...props}>
                {children}
            </BaseTabs.Tab>
        );
    }

    const { onKeyDown, onAuxClick, onMouseDown, ...rest } = props;

    const handleKeyDown = (e: Parameters<NonNullable<TabProps['onKeyDown']>>[0]): void => {
        onKeyDown?.(e);
        if (!e.defaultPrevented && e.target === e.currentTarget && (e.key === 'Delete' || e.key === 'Backspace')) {
            e.preventDefault();
            onClose();
        }
    };

    // A middle press starts autoscroll on some platforms; the release is what closes.
    const handleMouseDown = (e: Parameters<NonNullable<TabProps['onAuxClick']>>[0]): void => {
        onMouseDown?.(e);
        if (e.button === 1) {
            e.preventDefault();
        }
    };

    const handleAuxClick = (e: Parameters<NonNullable<TabProps['onAuxClick']>>[0]): void => {
        onAuxClick?.(e);
        if (!e.defaultPrevented && e.button === 1) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <BaseTabs.Tab
            nativeButton={false}
            render={<div />}
            className={withClass(TAB, className)}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onAuxClick={handleAuxClick}
            {...rest}
        >
            {children}
            <IconButton
                icon={X}
                size="2xs"
                label={t('tabs.close')}
                tabIndex={-1}
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            />
        </BaseTabs.Tab>
    );
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
            children: <Pill className="tabular-nums">{formatNumber(value)}</Pill>,
            className: clsx('inline-flex shrink-0', inMenu && 'ml-auto', className)
        }
    });
    return value === 0 ? null : element;
}
