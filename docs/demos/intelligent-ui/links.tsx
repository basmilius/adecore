import { ui } from '../shared/intelligent-ui-tree.ts';
import { DemoBlock } from '../shared/intelligent-ui.tsx';

export default function LinksDemo() {
    return (
        <DemoBlock
            nodes={[
                ui('File', { path: 'src/terminal/links.ts', line: 148 }, 'Cuts a path at a space'),
                ui('Diff', { path: 'src/preload.ts' }),
                ui('Commit', { sha: 'a1b2c3d' }),
                ui('Node', { id: 'research' }),
                ui('Node', { id: 'gone' })
            ]}
            context={{
                link: (target) => {
                    if (target.type !== 'Node') {
                        return { state: 'chip' };
                    }

                    return target.id === 'research'
                        ? { state: 'chip', label: 'Research', status: 'running' }
                        : { state: 'plain', reason: 'This node no longer exists.' };
                },
                openLink: () => undefined
            }}
        />
    );
}
