import type { UiProps } from '@adecore/intelligent-ui';
import { Icon, Pill, Tabs } from '@adecore/ui';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { createContext, useContext, useId } from 'react';
import { useBlockLocal } from '../block-local';
import { uiChildrenOf } from '../node-text';
import type { UiRendererProps } from '../render-context';
import { UI_TONE_PILL } from '../tones';

interface SectionsFold {
    /* Whether the person opened or closed a section of this set, after which nothing opens by itself. */
    touched: boolean;
    touch(): void;
}

const SectionsContext = createContext<SectionsFold>({ touched: false, touch: () => undefined });

/* A tab that arrives while the block streams is not picked: the one that was open stays open. A badge is a small count or label beside the title. */
export function TabsRenderer({ node, children, context }: UiRendererProps<UiProps<'Tabs'>>) {
    const tabs = uiChildrenOf(node, 'Tab');
    const [picked, setPicked] = useBlockLocal<string | null>(context, node.id, () => null);
    const value = picked !== null && tabs.some((tab) => tab.id === picked) ? picked : (tabs[0]?.id ?? null);

    return (
        <Tabs.Root value={value} onValueChange={(next) => setPicked(String(next))} className="flex flex-col gap-3">
            <Tabs.List variant="pill" overflow="scroll" className="w-fit max-w-full rounded-xl bg-ui-tile p-0.75">
                {tabs.map((tab) => (
                    <Tabs.Tab key={tab.id} value={tab.id} data-ui-reveal={tab.id}>
                        {tab.props.title}
                        {tab.props.badge !== undefined && tab.props.badge !== '' && (
                            <Pill size="sm" className="tabular-nums">
                                {tab.props.badge}
                            </Pill>
                        )}
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
            <div className="chat-ui-nodes flex flex-col gap-1.5">{children}</div>
        </SectionsContext>
    );
}

/*
 * Arrives as `open` says. Without it a section arrives open until the person folds one of the set themselves.
 * The badge is a tag at the end of the header, in the section's tone; the content keeps one margin on both sides.
 */
export function SectionRenderer({ node, children, context }: UiRendererProps<UiProps<'Section'>>) {
    const fold = useContext(SectionsContext);
    const { title, badge, tone } = node.props;
    const [open, setOpen] = useBlockLocal(context, node.id, () => node.props.open ?? !fold.touched);
    const contentId = useId();

    return (
        <section className="rounded-xl bg-ui-tile">
            <button
                type="button"
                data-ui-reveal={node.id}
                aria-expanded={open}
                aria-controls={contentId}
                className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-medium text-text hover:bg-text/4"
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
                <span className="min-w-0 grow truncate">{title}</span>
                {badge !== undefined && badge !== '' && (
                    <Pill shape="tag" size="sm" tone={tone === undefined ? 'muted' : UI_TONE_PILL[tone]}>
                        {badge}
                    </Pill>
                )}
            </button>
            <div id={contentId} hidden={!open} className="chat-ui-section-body chat-ui-nodes flex flex-col gap-3 px-3 pb-3">
                {children}
            </div>
        </section>
    );
}

/* The one component that divides the width: its panes stand side by side and stack in a narrow block. */
export function ColumnsRenderer({ node, children }: UiRendererProps<UiProps<'Columns'>>) {
    const panes = uiChildrenOf(node, 'Pane').length;

    return (
        <div className="@container">
            <div className={clsx('chat-ui-nodes grid gap-3', panes >= 3 ? '@min-[420px]:grid-cols-3' : '@min-[420px]:grid-cols-2')}>{children}</div>
        </div>
    );
}

/* Stacks its children as a tab panel does, under a small title where it has one. */
export function PaneRenderer({ node, children }: UiRendererProps<UiProps<'Pane'>>) {
    const { title } = node.props;
    const titleId = useId();
    const named = title !== undefined && title !== '';

    return (
        <section aria-labelledby={named ? titleId : undefined} className="chat-ui-nodes flex min-w-0 flex-col gap-2">
            {named && (
                <div id={titleId} className="px-0.5 text-2xs font-semibold text-text-muted">
                    {title}
                </div>
            )}
            {children}
        </section>
    );
}
