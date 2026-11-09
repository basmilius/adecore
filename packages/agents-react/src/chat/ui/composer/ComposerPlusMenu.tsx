import { Icon, Kbd, Menu, ScrollArea, Tooltip } from '@adecore/ui';
import { AtSign, Bookmark, BookmarkPlus, ChevronRight, Hash, Paperclip, Plus, SquareSlash, Trash2, Zap, type LucideIcon } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { forgetStashed, STASH_SHORTCUT, useStash, type StashedPrompt } from '../../stash';

/* The sigils this chat answers, with the same conditions as the placeholder's key caps. */
export interface PlusMenuSigils {
    mentionable: boolean;
    referable: boolean;
    hasSkills: boolean;
}

interface SigilRow {
    key: string;
    icon: LucideIcon;
    label: string;
    /* The hue of the chip the sigil makes in the draft. */
    tone?: string;
}

interface ComposerPlusMenuProps {
    writable: boolean;
    attachable: boolean;
    /* Whether the draft holds nothing: nothing to stash, and room for `/`, which only opens a command at the start. */
    emptyDraft: boolean;
    sigils: PlusMenuSigils;
    onAttach(): void;
    onRestore(prompt: StashedPrompt): void;
    onStash(): void;
    onSigil(sigil: string): void;
}

/*
 * Prompts put aside with Mod+S, on a shelf the whole app shares, since a stashed prompt usually moves
 * to another chat. A draft's files are named on the row but not kept: their bytes never go to storage.
 */
function StashedPrompts({
    prompts,
    onRestore,
    children
}: {
    prompts: readonly StashedPrompt[];
    onRestore(prompt: StashedPrompt): void;
    /* The item that stashes the draft, under the prompts. */
    children: ReactNode;
}) {
    const { t } = useTranslation('agent-chat');

    return (
        <Menu.Popup className="w-80">
            <ScrollArea className="max-h-72">
                {prompts.map((prompt) => (
                    <Menu.Row key={prompt.id} className="group/stash">
                        <Menu.Item className="flex-col items-start gap-0.5" label={prompt.text} onClick={() => onRestore(prompt)}>
                            <span className="line-clamp-2 whitespace-pre-wrap">{prompt.text || prompt.quote?.text || t('pickers.stash.noText')}</span>
                            {prompt.attachments.length > 0 && (
                                <span className="text-text-faint">{t('pickers.stash.files', { count: prompt.attachments.length })}</span>
                            )}
                            {prompt.chats.length > 0 && <span className="text-text-faint">{t('pickers.stash.chats', { count: prompt.chats.length })}</span>}
                        </Menu.Item>
                        <Menu.RowAction
                            icon={Trash2}
                            label={t('common.action.delete')}
                            closeOnClick={false}
                            className="opacity-0 group-hover/stash:opacity-100 data-[highlighted]:opacity-100"
                            onClick={() => forgetStashed(prompt.id)}
                        />
                    </Menu.Row>
                ))}
            </ScrollArea>
            <Menu.Separator />
            {children}
        </Menu.Popup>
    );
}

/* The + under the box: attach, the stash, and the sigils that open a picker, for a person who does not know the keys. */
export function ComposerPlusMenu({ writable, attachable, emptyDraft, sigils, onAttach, onRestore, onStash, onSigil }: ComposerPlusMenuProps) {
    const { t } = useTranslation('agent-chat');
    const prompts = useStash((state) => state.prompts);
    // A picked sigil puts the focus in the box, where its picker opens; the menu must not take it back to the +.
    const handedOff = useRef(false);

    const pickSigil = (sigil: string): void => {
        handedOff.current = true;
        onSigil(sigil);
    };

    const finalFocus = (): boolean => {
        const back = !handedOff.current;
        handedOff.current = false;

        return back;
    };

    const stashItem = (
        <Menu.Item disabled={emptyDraft} onClick={onStash}>
            <Icon icon={BookmarkPlus} size={14} className="text-text-faint" />
            {t('composer.plus.stash')}
            <Kbd shortcut={STASH_SHORTCUT} />
        </Menu.Item>
    );

    const rows: SigilRow[] = [
        ...(sigils.mentionable ? [{ key: '@', icon: AtSign, label: t('composer.plus.mention'), tone: 'text-accent' }] : []),
        ...(sigils.referable ? [{ key: '#', icon: Hash, label: t('composer.plus.reference') }] : []),
        ...(sigils.hasSkills ? [{ key: '$', icon: Zap, label: t('composer.plus.skill'), tone: 'text-skill' }] : []),
        { key: '/', icon: SquareSlash, label: t('composer.plus.commands') }
    ];

    return (
        <Menu.Root>
            <Tooltip label={t('composer.plus.label')} name>
                {/* The composer's controls are round, from attach to send, so this one keeps its own shape instead of `.icon-btn`'s. */}
                <Menu.Trigger
                    disabled={!writable}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-text-muted hover:bg-surface-hover-edged hover:text-text disabled:opacity-50 data-[popup-open]:bg-surface-hover data-[popup-open]:text-text"
                >
                    <Icon icon={Plus} size={16} />
                </Menu.Trigger>
            </Tooltip>
            <Menu.Popup side="top" sideOffset={8} align="start" className="w-64" finalFocus={finalFocus}>
                {attachable && (
                    <Menu.Item onClick={onAttach}>
                        <Icon icon={Paperclip} size={14} className="text-text-faint" />
                        {t('composer.plus.attach')}
                    </Menu.Item>
                )}
                {/* Without a stashed prompt there is nothing to open, so stashing stands in the menu itself. */}
                {prompts.length === 0 ? (
                    stashItem
                ) : (
                    <Menu.SubmenuRoot>
                        {/* The count sits against the chevron rather than halfway along the row. */}
                        <Menu.SubmenuTrigger chevron={false}>
                            <Icon icon={Bookmark} size={14} className="text-text-faint" />
                            {t('pickers.stash.title')}
                            <Menu.Hint className="tabular-nums">{prompts.length}</Menu.Hint>
                            <Icon icon={ChevronRight} size={14} className="-ml-1.5 text-text-faint" />
                        </Menu.SubmenuTrigger>
                        <StashedPrompts prompts={prompts} onRestore={onRestore}>
                            {stashItem}
                        </StashedPrompts>
                    </Menu.SubmenuRoot>
                )}
                <Menu.Separator />
                {rows.map((row) => (
                    <Menu.Item key={row.key} disabled={row.key === '/' && !emptyDraft} onClick={() => pickSigil(row.key)}>
                        <Icon icon={row.icon} size={14} className={row.tone ?? 'text-text-faint'} />
                        {row.label}
                        <Kbd>{row.key}</Kbd>
                    </Menu.Item>
                ))}
            </Menu.Popup>
        </Menu.Root>
    );
}
