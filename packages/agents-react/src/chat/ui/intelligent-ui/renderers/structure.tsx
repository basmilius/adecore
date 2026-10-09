import { createContext, useContext, useId } from 'react';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { UiProps } from '@adecore/intelligent-ui';
import { Icon, Tabs } from '@adecore/ui';
import { useBlockLocal } from '../block-local';
import { uiChildrenOf } from '../node-text';
import type { UiRendererProps } from '../render-context';

interface SectionsFold {
    /* Whether the person opened or closed a section of this set, after which nothing opens by itself. */
    touched: boolean;
    touch(): void;
}

const SectionsContext = createContext<SectionsFold>({ touched: false, touch: () => undefined });

/* A tab that arrives while the block streams is not picked: the one that was open stays open. */
export function TabsRenderer({ node, children, context }: UiRendererProps<UiProps<'Tabs'>>) {
    const tabs = uiChildrenOf(node, 'Tab');
    const [picked, setPicked] = useBlockLocal<string | null>(context, node.id, () => null);
    const value = picked !== null && tabs.some((tab) => tab.id === picked) ? picked : (tabs[0]?.id ?? null);
    return (
        <Tabs.Root value={value} onValueChange={(next) => setPicked(String(next))} className="flex flex-col gap-3">
            <Tabs.List className="px-2">
                {tabs.map((tab) => (
                    <Tabs.Tab key={tab.id} value={tab.id}>
                        {tab.props.title}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
            {children}
        </Tabs.Root>
    );
}

export function TabRenderer({ node, children }: UiRendererProps<UiProps<'Tab'>>) {
    return (
        <Tabs.Panel value={node.id} className="chat-ui-nodes flex flex-col gap-3">
            {children}
        </Tabs.Panel>
    );
}

export function SectionsRenderer({ node, children, context }: UiRendererProps<UiProps<'Sections'>>) {
    const [touched, setTouched] = useBlockLocal(context, node.id, () => false);
    return (
        <SectionsContext value={{ touched, touch: () => setTouched(true) }}>
            <div className="chat-ui-nodes flex flex-col divide-y divide-border-soft">{children}</div>
        </SectionsContext>
    );
}

/* Arrives open until the person folds a section of the set themselves; the content starts under the title. */
export function SectionRenderer({ node, children, context }: UiRendererProps<UiProps<'Section'>>) {
    const fold = useContext(SectionsContext);
    const [open, setOpen] = useBlockLocal(context, node.id, () => !fold.touched);
    const contentId = useId();
    return (
        <section>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={contentId}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-text hover:bg-surface-hover"
                onClick={() => {
                    fold.touch();
                    setOpen(!open);
                }}
            >
                <Icon
                    icon={ChevronRight}
                    size={14}
                    className={clsx('shrink-0 text-text-faint transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')}
                />
                <span className="min-w-0 truncate">{node.props.title}</span>
            </button>
            <div id={contentId} hidden={!open} className="chat-ui-nodes flex flex-col gap-3 pt-1 pr-2 pb-2 pl-7.5">
                {children}
            </div>
        </section>
    );
}
