import type { MouseEvent } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';
import { Icon } from './Icon.tsx';
import * as Menu from './menu/index.parts.ts';
import type { ProjectSwitcherItem } from './ProjectSwitcher.tsx';
import { Tooltip } from './Tooltip.tsx';

export function ProjectSwitcherRow<Item extends ProjectSwitcherItem>({
    project,
    onSelect
}: {
    project: Item;
    onSelect(project: Item, event: MouseEvent<HTMLElement>): void;
}) {
    const { t } = useTranslation('ui');
    const hasActions = Boolean(project.actions);
    const item = (
        <Menu.Item
            className={clsx('min-w-0 flex-1', project.muted && 'opacity-50')}
            disabled={project.disabled}
            label={project.name}
            onClick={(event) => onSelect(project, event)}
        >
            {project.icon}
            <span className="min-w-0 truncate">{project.name}</span>
            {project.hint && <span className="ml-auto truncate pl-3 text-xs text-text-faint">{project.hint}</span>}
        </Menu.Item>
    );
    const row = project.description ? (
        <Tooltip label={project.description} side="right" sideOffset={hasActions ? 41 : undefined}>
            {item}
        </Tooltip>
    ) : (
        item
    );

    if (!hasActions) {
        return row;
    }

    return (
        <div className="project-switcher-row flex min-w-0 items-stretch" role="group" aria-label={project.name}>
            {row}
            <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                    className="project-switcher-actions shrink-0"
                    chevron={false}
                    aria-label={t('projectSwitcher.actionsFor', { name: project.name })}
                    label={t('projectSwitcher.actionsFor', { name: project.name })}
                >
                    <Icon icon={MoreHorizontal} size={14} />
                </Menu.SubmenuTrigger>
                <Menu.Popup className="min-w-52">{project.actions}</Menu.Popup>
            </Menu.SubmenuRoot>
        </div>
    );
}
