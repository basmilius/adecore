import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { SquareSlash, Zap } from 'lucide-react';
import { FileIcon, Icon, Menu, MiddleTruncate } from '@adecore/ui';
import { REFERENCE_ICONS } from '../reference-icons';
import type { ComposerMenus as Menus } from './use-composer-menus';
import { optionIdOf } from './menu-aria';

function splitPath(path: string): { name: string; dir: string } {
    const slash = path.lastIndexOf('/');

    return slash < 0 ? { name: path, dir: '' } : { name: path.slice(slash + 1), dir: path.slice(0, slash) };
}

interface OptionProps {
    menus: Menus;
    index: number;
    className: string;
    onPick(): void;
    children: ReactNode;
}

/* A row of a picker. The focus stays in the editor, which names the active row through `aria-activedescendant`. */
function MenuOption({ menus, index, className, onPick, children }: OptionProps) {
    return (
        <button
            id={optionIdOf(menus.listId, index)}
            role="option"
            aria-selected={index === menus.activeIndex}
            tabIndex={-1}
            data-active={index === menus.activeIndex}
            className={clsx('cursor-row flex w-full gap-2 rounded-md px-2 py-1 text-left text-xs text-text-muted', className)}
            onMouseEnter={() => menus.setMenuIndex(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPick}
        >
            {children}
        </button>
    );
}

function CommandMenu({ menus }: { menus: Menus }) {
    const { t } = useTranslation('agent-chat');

    return (
        <div id={menus.listId} role="listbox" aria-label={t('composer.menu.commands')} className="border-b border-border px-1.5 py-1.5">
            {menus.commands.map((command, index) => (
                <MenuOption key={command.name} menus={menus} index={index} className="items-center" onPick={() => menus.pickCommand(command, index)}>
                    <Icon icon={command.skill ? Zap : SquareSlash} size={12} className={clsx('shrink-0', command.skill ? 'text-skill' : 'text-text-faint')} />
                    <span className="font-mono text-text">/{command.name}</span>
                    <span className="text-text-faint">{command.hint}</span>
                </MenuOption>
            ))}
        </div>
    );
}

function SkillMenu({ menus }: { menus: Menus }) {
    const { t } = useTranslation('agent-chat');

    return (
        <div id={menus.listId} role="listbox" aria-label={t('composer.menu.skills')} className="border-b border-border px-1.5 py-1.5">
            {menus.skillMatches.map((skill, index) => (
                <MenuOption key={skill.name} menus={menus} index={index} className="items-start" onPick={() => menus.chooseSkill(skill.name)}>
                    <Icon icon={Zap} size={12} className="mt-0.5 shrink-0 text-skill" />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-text">${skill.name}</span>
                        {skill.description !== '' && <span className="line-clamp-1 text-text-faint">{skill.description}</span>}
                    </span>
                </MenuOption>
            ))}
        </div>
    );
}

function MentionMenu({ menus, query }: { menus: Menus; query: string }) {
    const { t } = useTranslation('agent-chat');
    const { listId, files, mentionCount } = menus;
    const filesLabelId = `${listId}-files`;
    const filesLabelShown = query === '';

    return (
        <div className="border-b border-border px-1.5 py-1.5">
            {mentionCount > 0 && (
                <div id={listId} role="listbox" {...(filesLabelShown ? { 'aria-labelledby': filesLabelId } : { 'aria-label': t('composer.mentions.files') })}>
                    {filesLabelShown && <Menu.Label id={filesLabelId}>{t('composer.mentions.here')}</Menu.Label>}
                    {files.map((path, index) => {
                        const { name, dir } = splitPath(path);

                        return (
                            <MenuOption key={path} menus={menus} index={index} className="items-center" onPick={() => menus.chooseMention(path)}>
                                <FileIcon path={path} size={14} />
                                <span className="truncate font-mono text-text">{name}</span>
                                {dir && <MiddleTruncate text={dir} tooltip={false} className="text-text-faint" />}
                            </MenuOption>
                        );
                    })}
                </div>
            )}
            {mentionCount === 0 && (
                <div className="px-2 py-1 text-xs text-text-faint">{query ? t('composer.mentions.noMatch') : t('composer.mentions.empty')}</div>
            )}
        </div>
    );
}

/* The views, nodes and chats a `#` offers, what stands on this canvas first, each with its kind or what tells it apart. */
function ReferenceMenu({ menus }: { menus: Menus }) {
    const { t } = useTranslation('agent-chat');
    const { listId, referenceMatches } = menus;

    const groups = (['canvas', 'views'] as const)
        .map((group) => ({ group, items: referenceMatches.filter((item) => item.group === group) }))
        .filter((entry) => entry.items.length > 0);

    return (
        <div className="border-b border-border px-1.5 py-1.5">
            {referenceMatches.length > 0 ? (
                <div id={listId} role="listbox" aria-label={t('composer.menu.references')}>
                    {groups.map(({ group, items }) => (
                        <div key={group} role="group" aria-labelledby={`${listId}-${group}`}>
                            <Menu.Label id={`${listId}-${group}`}>{t(`composer.references.${group}`)}</Menu.Label>
                            {items.map((item) => {
                                const index = referenceMatches.indexOf(item);

                                return (
                                    <MenuOption key={item.id} menus={menus} index={index} className="items-center" onPick={() => menus.chooseReference(item)}>
                                        <Icon icon={REFERENCE_ICONS[item.kind]} size={14} className="shrink-0 text-text-faint" />
                                        <span className="truncate text-text">{item.name}</span>
                                        <span className="ml-auto shrink-0 truncate pl-2 text-text-faint">
                                            {item.detail ?? t(`composer.references.kinds.${item.kind}`)}
                                        </span>
                                    </MenuOption>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-2 py-1 text-xs text-text-faint">{t('composer.references.noMatch')}</div>
            )}
        </div>
    );
}

/* Whichever picker the caret opened, over the box. */
export function ComposerMenu({ menus }: { menus: Menus }) {
    if (menus.commandMenuOpen) {
        return <CommandMenu menus={menus} />;
    }

    if (menus.skillMenuOpen) {
        return <SkillMenu menus={menus} />;
    }

    if (menus.mentionMenuOpen && menus.mention !== null) {
        return <MentionMenu menus={menus} query={menus.mention.query} />;
    }

    if (menus.referenceMenuOpen) {
        return <ReferenceMenu menus={menus} />;
    }

    return null;
}
