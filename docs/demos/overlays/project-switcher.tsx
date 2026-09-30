import { useState } from 'react';
import { Folder, FolderOpen, Settings2, X } from 'lucide-react';
import { Icon, Menu, ProjectSwitcher, type ProjectSwitcherItem } from '@basmilius/desktop-ui';

const PROJECTS: ProjectSwitcherItem[] = [
    { id: 'studio', name: 'Studio', icon: <Icon icon={Folder} size={16} />, description: '~/Projects/studio', hint: 'This Mac' },
    { id: 'website', name: 'Website', icon: <Icon icon={Folder} size={16} />, description: '~/Projects/website', hint: 'This Mac' },
    { id: 'archive', name: 'Archive', icon: <Icon icon={Folder} size={16} />, description: '/work/archive', hint: 'Laptop', muted: true }
];

const RECENT: ProjectSwitcherItem[] = [{ id: 'notes', name: 'Notes', icon: <Icon icon={Folder} size={16} />, description: '~/Projects/notes' }];

export default function ProjectSwitcherDemo() {
    const [current, setCurrent] = useState(PROJECTS[0]!);
    const [projects, setProjects] = useState(PROJECTS);
    const [recent, setRecent] = useState(RECENT);
    const [message, setMessage] = useState('');

    return (
        <div className="flex flex-col items-start gap-3">
            <ProjectSwitcher
                current={current}
                projects={projects.map((project): ProjectSwitcherItem => ({
                    ...project,
                    actions: (
                        <>
                            <Menu.Item onClick={() => setMessage(`Settings for ${project.name}`)}>
                                <Icon icon={Settings2} size={14} /> Project settings…
                            </Menu.Item>
                            <Menu.Separator />
                            <Menu.Item
                                onClick={() => {
                                    setProjects((rows) => rows.filter((row) => row.id !== project.id));
                                    setRecent((rows) => [project, ...rows]);
                                    setMessage(`Closed ${project.name}`);
                                }}
                            >
                                <Icon icon={X} size={14} /> Close project
                            </Menu.Item>
                        </>
                    )
                }))}
                recentProjects={recent}
                onSelect={(project, event) => {
                    if (event.metaKey || event.ctrlKey) {
                        setMessage(`Open ${project.name} in another window`);
                        return;
                    }
                    setCurrent(project);
                    setProjects((rows) => (rows.some((row) => row.id === project.id) ? rows : [...rows, project]));
                    setRecent((rows) => rows.filter((row) => row.id !== project.id));
                    setMessage(`Selected ${project.name}`);
                }}
            >
                <Menu.Item onClick={() => setMessage('Choose a project folder')}>
                    <Icon icon={FolderOpen} size={14} /> Open folder
                </Menu.Item>
            </ProjectSwitcher>
            <span role="status" className="text-xs text-text-muted">
                {message || 'Choose a project or open its actions.'}
            </span>
        </div>
    );
}
