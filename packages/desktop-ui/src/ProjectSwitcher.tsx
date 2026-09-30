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
    /* A machine or workspace name at the end of the row. */
    hint?: ReactNode;
    disabled?: boolean;
    /* A stale or disconnected project can still be selected to try opening it. */
    muted?: boolean;
    /* Menu items for the submenu beside this project's row. */
    actions?: ReactNode;
}

export interface ProjectSwitcherProps<Item extends ProjectSwitcherItem = ProjectSwitcherItem> {
    current: ProjectSwitcherItem | null;
    projects: readonly Item[];
    recentProjects?: readonly Item[];
    onSelect(project: Item, event: MouseEvent<HTMLElement>): void;
    /* Before the current project's icon, such as the machine it runs on. */
    leading?: ReactNode;
    /* Menu items after the projects, such as opening a folder or creating a project. */
    children?: ReactNode;
    label?: string;
    disabled?: boolean;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: ComponentProps<typeof Menu.Root>['onOpenChange'];
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

export function ProjectSwitcher<Item extends ProjectSwitcherItem>({
    current,
    projects,
    recentProjects = [],
    onSelect,
    leading,
    children,
    label,
    disabled,
    open,
    defaultOpen,
    onOpenChange,
    className,
    ref
}: ProjectSwitcherProps<Item>) {
    const { t } = useTranslation('ui');

    return (
        <Menu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
            <Menu.Trigger
                ref={ref}
                disabled={disabled}
                aria-label={label ?? current?.name ?? t('projectSwitcher.label')}
                className={clsx('project-switcher-trigger', className)}
            >
                {leading}
                {current?.icon}
                <span className="truncate text-sm font-medium text-text">{current?.name ?? t('projectSwitcher.label')}</span>
                <Icon icon={ChevronDown} size={14} className="shrink-0 text-text-muted" />
            </Menu.Trigger>
            <Menu.Popup className="min-w-60">
                {projects.map((project) => (
                    <ProjectSwitcherRow key={project.id} project={project} onSelect={onSelect} />
                ))}
                {recentProjects.length > 0 && (
                    <>
                        {projects.length > 0 && <Menu.Separator />}
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
                    </>
                )}
                {children && (
                    <>
                        {(projects.length > 0 || recentProjects.length > 0) && <Menu.Separator />}
                        {children}
                    </>
                )}
            </Menu.Popup>
        </Menu.Root>
    );
}
