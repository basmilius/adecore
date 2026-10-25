import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, ChevronDown, ChevronRight, Search, Star, Trash2 } from 'lucide-react';
import type { AgentKind, ModelSelection, ProviderInfo, UsageProvider } from '@adecore/agent-contracts';
import { AgentIcon } from '../../agents/AgentIcon';
import { ProviderLogo } from '../../agents/ProviderLogo';
import { agentChipOf, modelName } from '../../agents/model-name';
import { modelRequirementOf } from '../../agents/model-requirement';
import { useChatHost } from '../../host';
import { ChatScopeContext } from '../../scope';
import { useReportedModels } from '../../state/chats';
import { ModelMarks } from './ModelMarks';
import { inPickerOrder, pickerEntriesOf, separatesFrontier, type PickerEntry } from '../logic/picker-entries';
import { favoriteModelsOf, toggleFavoriteModel, useChatPreferences } from '../preferences';
import { forgetStashed, STASH_SHORTCUT, useStash, type StashedPrompt } from '../stash';
import { Button, Icon, IconButton, Menu, Popover, Tooltip } from '@adecore/ui';
import { useHostMachineLabel } from '../../host-hooks';

const triggerClass =
    'flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs text-text-muted hover:bg-surface-hover hover:text-text data-[popup-open]:bg-surface-active data-[popup-open]:text-text';

interface ModelPickerProps {
    /* Whose models may be picked: every installed chat CLI before the first message, the chat's own after it. */
    providers: ProviderInfo[];
    provider: AgentKind;
    selection: ModelSelection;
    /* Controlled, so `/model` in the composer can open the same popup a click on the trigger does. */
    open: boolean;
    onOpenChange(open: boolean): void;
    onChange(provider: AgentKind, model: string): void;
    /* The composer's `/model`; `null` for a picker outside a chat, where that command does nothing. */
    kbd?: string | null;
    /* Where the popup opens: over the composer by default, below the trigger in a form. */
    side?: 'top' | 'bottom';
    /* `chip` names the provider beside the model on a secondary button, for a picker that sits in a card or a form. */
    trigger?: 'plain' | 'chip';
    /* Where the focus goes when the popup closes; by default back to the trigger. */
    finalFocus?: RefObject<HTMLElement | null>;
    /* A note under the list, such as what picking an agent here does. */
    footer?: ReactNode;
}

/*
 * Which model answers: a search field over one group per provider, with the legacy models behind an
 * expander. Before the first message the list carries every installed CLI, so picking another
 * provider's model is also how a chat picks its provider; with one CLI the group headers drop.
 */
export function ModelPicker({
    providers,
    provider,
    selection,
    open,
    onOpenChange,
    onChange,
    kbd = '/model',
    side = 'top',
    trigger = 'plain',
    finalFocus,
    footer
}: ModelPickerProps) {
    const host = useChatHost();
    const { t } = useTranslation('agent-chat');
    const [query, setQuery] = useState('');
    const [legacyOpen, setLegacyOpen] = useState(false);
    const [expanded, setExpanded] = useState<ReadonlySet<AgentKind>>(new Set());
    const [index, setIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const owner = providers.find((entry) => entry.kind === provider);
    const current = modelName(selection.model, owner?.models);
    const chip = agentChipOf(providers, provider, selection.model);
    const grouped = providers.length > 1;
    const trimmed = query.trim().toLowerCase();

    const favorites = useChatPreferences((preferences) => preferences.favoriteModels);
    const starredHere = (row: PickerEntry | undefined): boolean => row?.kind === 'model' && favorites[row.provider.kind]?.includes(row.model.slug) === true;
    const entries = pickerEntriesOf(inPickerOrder(providers), trimmed, legacyOpen, expanded, { provider, model: selection.model }, (kind) =>
        favoriteModelsOf(favorites, kind)
    );
    const scope = useContext(ChatScopeContext);
    const machine = useHostMachineLabel(scope?.id ?? '');
    const reported = useReportedModels(provider);
    const requirementOf = (entry: PickerEntry & { kind: 'model' }) => modelRequirementOf(entry.model, entry.provider, reported);
    // A CLI that is too old blocks all its models; one way to its settings under the group says it once.
    const kindBefore = (i: number): AgentKind | undefined => {
        const before = entries[i - 1];
        return before === undefined || before.kind === 'legacy' ? undefined : before.provider.kind;
    };
    const blockedKinds = new Set(entries.flatMap((entry) => (entry.kind === 'model' && requirementOf(entry) !== null ? [entry.provider.kind] : [])));

    /* Closing forgets the search, so the next open (a click or `/model`) starts on the whole list. */
    const setOpen = (next: boolean): void => {
        if (!next) {
            setQuery('');
            setLegacyOpen(false);
            setExpanded(new Set());
        }
        setIndex(0);
        onOpenChange(next);
    };

    // The list scrolls, so the row the arrows moved to has to come along.
    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [index]);

    const choose = (entry: PickerEntry | undefined): void => {
        if (!entry) {
            return;
        }
        if (entry.kind === 'legacy') {
            setLegacyOpen(true);
            inputRef.current?.focus();
            return;
        }
        if (entry.kind === 'all') {
            const kind = entry.provider.kind;
            setExpanded((now) => {
                const next = new Set(now);
                if (!next.delete(kind)) {
                    next.add(kind);
                }
                return next;
            });
            inputRef.current?.focus();
            return;
        }
        if (requirementOf(entry) !== null) {
            return;
        }
        onChange(entry.provider.kind, entry.model.slug);
        setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => (entries.length === 0 ? 0 : (i + 1) % entries.length));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => (entries.length === 0 ? 0 : (i - 1 + entries.length) % entries.length));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(entries[index]);
        }
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Tooltip label={owner ? `${owner.name} · ${current}` : t('pickers.model.choose')} kbd={kbd ?? undefined}>
                {trigger === 'chip' ? (
                    <Popover.Trigger render={<Button variant="secondary" size="sm" className="min-w-0 shrink gap-1.5" />}>
                        {chip.mark === 'logo' ? <ProviderLogo provider={provider as UsageProvider} size={12} /> : <AgentIcon kind={provider} size={12} />}
                        <span className="truncate">{chip.name}</span>
                        <span className="max-w-32 truncate text-text-muted">{chip.model}</span>
                        <Icon icon={ChevronDown} size={12} className="shrink-0 text-text-faint" />
                    </Popover.Trigger>
                ) : (
                    <Popover.Trigger className={triggerClass}>
                        <AgentIcon kind={provider} size={12} />
                        <span className="max-w-40 truncate">{current}</span>
                        <Icon icon={ChevronDown} size={12} className="text-text-faint" />
                    </Popover.Trigger>
                )}
            </Tooltip>
            <Popover.Popup variant="picker" side={side} initialFocus={inputRef} {...(finalFocus === undefined ? {} : { finalFocus })}>
                <div className="flex items-center gap-2 border-b border-border px-2.5">
                    <Icon icon={Search} size={14} className="shrink-0 text-text-faint" />
                    <input
                        ref={inputRef}
                        className="h-8 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
                        placeholder={t('pickers.model.search')}
                        spellCheck={false}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIndex(0);
                        }}
                        onKeyDown={onKeyDown}
                    />
                </div>
                <div ref={listRef} className="max-h-72 overflow-auto p-1" role="listbox">
                    {entries.length === 0 && (
                        <div className="px-3 py-6 text-center text-xs text-text-faint">
                            {providers.length === 0 ? t('pickers.model.noProvider') : t('pickers.model.noMatch')}
                        </div>
                    )}
                    {entries.map((entry, i) => {
                        if (entry.kind === 'all') {
                            const before = entries[i - 1];
                            const header = grouped && (before === undefined || before.kind === 'legacy' || before.provider.kind !== entry.provider.kind);
                            return (
                                <div key={`all-${entry.provider.kind}`}>
                                    {separatesFrontier(kindBefore(i), entry.provider.kind) && <Menu.Separator />}
                                    {header && (
                                        <Menu.Label className="flex items-center gap-1.5">
                                            <AgentIcon kind={entry.provider.kind} size={12} />
                                            {entry.provider.name}
                                        </Menu.Label>
                                    )}
                                    <button
                                        data-active={i === index}
                                        aria-expanded={entry.open}
                                        className="cursor-row flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-text-muted"
                                        onMouseEnter={() => setIndex(i)}
                                        onClick={() => choose(entry)}
                                    >
                                        <Icon icon={entry.open ? ChevronDown : ChevronRight} size={12} />
                                        {t('pickers.model.allGroup', { count: entry.count })}
                                    </button>
                                </div>
                            );
                        }
                        if (entry.kind === 'legacy') {
                            return (
                                <button
                                    key="legacy"
                                    data-active={i === index}
                                    className="cursor-row flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-text-faint"
                                    onMouseEnter={() => setIndex(i)}
                                    onClick={() => choose(entry)}
                                >
                                    <Icon icon={legacyOpen ? ChevronDown : ChevronRight} size={12} />
                                    {t('pickers.model.legacyGroup', { count: entry.count })}
                                </button>
                            );
                        }
                        const previous = entries[i - 1];
                        // A provider's rows start where the one before it ended; its row that opens the rest belongs to it.
                        const first = grouped && (previous === undefined || previous.kind === 'legacy' || previous.provider.kind !== entry.provider.kind);
                        // The makers read as groups only where the whole list is shown, so a short list is not cut by labels.
                        const vendorOpen = trimmed !== '' || expanded.has(entry.provider.kind);
                        // The starred rows lead their CLI without a maker's label; the makers start after them.
                        const vendorFirst =
                            vendorOpen &&
                            entry.model.vendor !== undefined &&
                            !starredHere(entry) &&
                            (previous === undefined ||
                                previous.kind !== 'model' ||
                                previous.provider.kind !== entry.provider.kind ||
                                starredHere(previous) ||
                                previous.model.vendor !== entry.model.vendor);
                        const requirement = requirementOf(entry);
                        const next = entries[i + 1];
                        const lastOfGroup = next === undefined || next.kind !== 'model' || next.provider.kind !== entry.provider.kind;
                        const chosen = entry.provider.kind === provider && entry.model.slug === selection.model;
                        const starred = starredHere(entry);
                        return (
                            <div key={`${entry.provider.kind}/${entry.model.slug}`}>
                                {separatesFrontier(kindBefore(i), entry.provider.kind) && <Menu.Separator />}
                                {first && (
                                    <Menu.Label className="flex items-center gap-1.5">
                                        <AgentIcon kind={entry.provider.kind} size={12} />
                                        {entry.provider.name}
                                    </Menu.Label>
                                )}
                                {vendorFirst && <Menu.Label>{entry.model.vendor}</Menu.Label>}
                                {/* The star sits beside the option rather than in it, since a button holds no other button. */}
                                <div className="flex items-start gap-0.5">
                                    <button
                                        role="option"
                                        aria-selected={chosen}
                                        aria-disabled={requirement !== null || undefined}
                                        data-active={i === index}
                                        className={`cursor-row flex min-w-0 grow flex-col items-stretch gap-0.5 rounded-md px-2.5 py-1.5 text-left text-sm ${requirement === null ? 'text-text-muted' : 'text-text-faint'}`}
                                        onMouseEnter={() => setIndex(i)}
                                        onClick={() => choose(entry)}
                                    >
                                        <span className="flex w-full items-center gap-2">
                                            <Menu.Check kind="radio" checked={chosen} />
                                            {/* Wrapped rather than cut, so a long name a provider gives is read whole. */}
                                            <span className="min-w-0 break-words">{entry.model.name}</span>
                                            <ModelMarks model={entry.model} />
                                            <span className="grow" />
                                            {entry.model.legacy && <span className="text-xs text-text-faint">{t('pickers.model.legacy')}</span>}
                                        </span>
                                        {requirement !== null && (
                                            <span className="pl-6 text-xs text-text-faint">
                                                {machine === null
                                                    ? t('pickers.model.requiresHere', { cli: requirement.cli, version: requirement.minVersion })
                                                    : t('pickers.model.requires', { cli: requirement.cli, version: requirement.minVersion, machine })}
                                            </span>
                                        )}
                                    </button>
                                    <IconButton
                                        icon={Star}
                                        size="sm"
                                        label={starred ? t('pickers.model.unstar') : t('pickers.model.star')}
                                        aria-pressed={starred}
                                        iconClassName={starred ? 'fill-current text-accent' : undefined}
                                        className="mt-0.5 shrink-0"
                                        onClick={() => toggleFavoriteModel(entry.provider.kind, entry.model.slug)}
                                    />
                                </div>
                                {lastOfGroup && blockedKinds.has(entry.provider.kind) && (
                                    <button
                                        type="button"
                                        className="cursor-row flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-text-muted"
                                        onClick={() => {
                                            setOpen(false);
                                            host.openSettings('providers');
                                        }}
                                    >
                                        {t('pickers.model.providerSettings')}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                {footer !== undefined && <div className="border-t border-border-soft px-3 py-2 text-xs text-text-faint">{footer}</div>}
            </Popover.Popup>
        </Popover.Root>
    );
}

/*
 * Prompts put aside with Cmd+S, on a shelf the whole app shares, since a stashed prompt usually moves
 * to another chat. A draft's files are named on the row but not kept: their bytes never go to storage.
 */
export function StashPicker({ onRestore }: { onRestore(prompt: StashedPrompt): void }) {
    const { t } = useTranslation('agent-chat');
    const prompts = useStash((s) => s.prompts);
    if (prompts.length === 0) {
        return null;
    }
    return (
        <Popover.Root>
            <Tooltip label={t('pickers.stash.title')} kbd={STASH_SHORTCUT}>
                <Popover.Trigger className={triggerClass}>
                    <Icon icon={Bookmark} size={12} />
                    <span className="tabular-nums">{prompts.length}</span>
                </Popover.Trigger>
            </Tooltip>
            <Popover.Popup variant="picker" side="top" className="w-80">
                <div className="max-h-72 overflow-auto p-1">
                    {prompts.map((prompt) => (
                        <div key={prompt.id} className="group/stash flex items-start gap-1">
                            <Popover.Close
                                className="flex min-w-0 grow flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs text-text-muted hover:bg-surface-hover hover:text-text"
                                onClick={() => onRestore(prompt)}
                            >
                                <span className="line-clamp-2 whitespace-pre-wrap">{prompt.text || prompt.quote?.text || t('pickers.stash.noText')}</span>
                                {prompt.attachments.length > 0 && (
                                    <span className="text-text-faint">{t('pickers.stash.files', { count: prompt.attachments.length })}</span>
                                )}
                                {prompt.chats.length > 0 && <span className="text-text-faint">{t('pickers.stash.chats', { count: prompt.chats.length })}</span>}
                            </Popover.Close>
                            <IconButton
                                icon={Trash2}
                                size="xs"
                                label={t('common.action.delete')}
                                className="mt-1 opacity-0 group-hover/stash:opacity-100 focus-visible:opacity-100"
                                onClick={() => forgetStashed(prompt.id)}
                            />
                        </div>
                    ))}
                </div>
            </Popover.Popup>
        </Popover.Root>
    );
}
