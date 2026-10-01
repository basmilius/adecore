import { useState } from 'react';
import { Circle, Ellipsis, ListTodo, Pencil, Play, Square, Trash } from 'lucide-react';
import { Button, Icon, Menu } from '@basmilius/desktop-ui';

const TASKS = ['Dev server', 'Tests', 'Docs'];

export default function MenuRowDemo() {
    const [running, setRunning] = useState<string[]>(['Dev server']);
    const [message, setMessage] = useState('');

    const toggle = (task: string) => setRunning((tasks) => (tasks.includes(task) ? tasks.filter((entry) => entry !== task) : [...tasks, task]));

    return (
        <div className="flex flex-col items-start gap-3">
            <Menu.Root>
                <Menu.Trigger render={<Button variant="secondary" />}>
                    <Icon icon={ListTodo} size={14} /> Tasks
                </Menu.Trigger>
                <Menu.Popup className="min-w-64">
                    {TASKS.map((task) => {
                        const live = running.includes(task);
                        return (
                            <Menu.Row key={task} aria-label={task}>
                                <Menu.Item onClick={() => setMessage(`Show the output of ${task}`)}>
                                    <Icon icon={Circle} size={12} className={live ? 'fill-current text-status-running' : 'text-text-faint'} /> {task}
                                </Menu.Item>
                                <Menu.RowAction
                                    icon={live ? Square : Play}
                                    label={live ? `Stop ${task}` : `Start ${task}`}
                                    iconClassName="fill-current"
                                    closeOnClick={false}
                                    onClick={() => toggle(task)}
                                />
                                <Menu.SubmenuRoot>
                                    <Menu.RowSubmenuTrigger icon={Ellipsis} label={`More for ${task}`} />
                                    <Menu.Popup>
                                        <Menu.Item onClick={() => setMessage(`Edit ${task}`)}>
                                            <Icon icon={Pencil} size={14} /> Edit
                                        </Menu.Item>
                                        <Menu.Item onClick={() => setMessage(`Remove ${task}`)}>
                                            <Icon icon={Trash} size={14} /> Remove
                                        </Menu.Item>
                                    </Menu.Popup>
                                </Menu.SubmenuRoot>
                            </Menu.Row>
                        );
                    })}
                </Menu.Popup>
            </Menu.Root>
            <span role="status" className="text-xs text-text-muted">
                {message || `${running.length} of ${TASKS.length} running.`}
            </span>
        </div>
    );
}
