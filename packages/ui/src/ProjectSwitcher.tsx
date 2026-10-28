import type { ComponentProps, MouseEvent, ReactNode, Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ChevronDown, History } from 'lucide-react';
import { Icon } from './Icon.tsx';
import * as Menu from './menu/index.parts.ts';
import { ProjectSwitcherRow } from './project-switcher-row.tsx';

export interface ProjectSwitcherItem {
    id: string;
    name: string;
    icon?: ReactNode;

    /* The folder or other details, shown in a tooltip so the row stays on one line. */
    description?: ReactNode;

    /* At the end of the row. */
    hint?: ReactNode;

    disabled?: boolean;

    /* A stale or disconnected project can still be selected to try opening it. */
    muted?: boolean;

    /* For the submenu beside this project's row. */
    actions?: ReactNode;
}

export interface ProjectSwitcherProps<Item extends ProjectSwitcherItem = ProjectSwitcherItem> {
    current: ProjectSwitcherItem | null;
    projects: readonly Item[];
    recentProjects?: readonly Item[];
    onSelect(project: Item, event: MouseEvent<HTMLElement>): void;

    /* Before the current project's icon. */
    leading?: ReactNode;

    /* A group of their own between the open projects and Recent projects. */
    before?: ReactNode;

    /* In one group with Recent projects. */
    children?: ReactNode;

    /* What the trigger reads while `current` is null; next to a current project, it comes before that name in the accessible name. */
    label?: string;

    disabled?: boolean;
    tabIndex?: number;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: ComponentProps<typeof Menu.Root>['onOpenChange'];
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

export function ProjectSwitcher<Item extends ProjectSwitcherItem>({
    current,
    projects,
    recentProjects,
    onSelect,
    leading,
    before,
    children,
    label,
    disabled,
    tabIndex,
    open,
    defaultOpen,
    onOpenChange,
    className,
    ref
}: ProjectSwitcherProps<Item>) {
    const { t } = useTranslation('ui');
    const empty = label ?? t('projectSwitcher.label');

    return (
        <Menu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
            <Menu.Trigger
                ref={ref}
                disabled={disabled}
                tabIndex={tabIndex}
                aria-label={current === null ? empty : label === undefined ? current.name : `${label}: ${current.name}`}
                className={clsx('project-switcher-trigger', className)}
            >
                {leading}
                {current?.icon}
                <span className="truncate text-sm font-medium text-text">{current?.name ?? empty}</span>
                <Icon icon={ChevronDown} size={14} className="shrink-0 text-text-muted" />
            </Menu.Trigger>
            <Menu.Popup className="min-w-60">
                <ProjectSwitcherGroups projects={projects} recentProjects={recentProjects} before={before} onSelect={onSelect}>
                    {children}
                </ProjectSwitcherGroups>
            </Menu.Popup>
        </Menu.Root>
    );
}

/* Apart from the popup, so the rows render without an open menu. */
export function ProjectSwitcherGroups<Item extends ProjectSwitcherItem>({
    projects,
    recentProjects = [],
    before,
    children,
    onSelect
}: Pick<ProjectSwitcherProps<Item>, 'projects' | 'recentProjects' | 'before' | 'children' | 'onSelect'>) {
    const { t } = useTranslation('ui');

    // The theme hides a separator at the top of a menu or against another, so a group that draws
    // nothing leaves no line behind.
    return (
        <>
            {projects.map((project) => (
                <ProjectSwitcherRow key={project.id} project={project} onSelect={onSelect} />
            ))}
            {before && (
                <>
                    <Menu.Separator />
                    {before}
                </>
            )}
            {(recentProjects.length > 0 || children) && (
                <>
                    <Menu.Separator />
                    {recentProjects.length > 0 && (
                        <Menu.SubmenuRoot>
                            <Menu.SubmenuTrigger>
                                <Icon icon={History} size={14} /> {t('projectSwitcher.recent')}
                            </Menu.SubmenuTrigger>
                            <Menu.Popup className="min-w-60">
                                {recentProjects.map((project) => (
                                    <ProjectSwitcherRow key={project.id} project={project} onSelect={onSelect} />
                                ))}
                            </Menu.Popup>
                        </Menu.SubmenuRoot>
                    )}
                    {children}
                </>
            )}
        </>
    );
}
