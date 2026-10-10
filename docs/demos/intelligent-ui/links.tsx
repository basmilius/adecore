import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { ui } from '../shared/intelligent-ui-tree.ts';

export default function LinksDemo() {
    return (
        <DemoBlock
            nodes={[
                ui('File', { path: 'src/terminal/links.ts', line: 148 }, 'Cuts a path at a space'),
                ui('Diff', { path: 'src/preload.ts' }),
                ui('Commit', { sha: 'a1b2c3d' }),
                ui('Node', { id: 'gone' })
            ]}
            context={{
                link: (target) => (target.type === 'Node' ? { state: 'plain', reason: 'This node no longer exists.' } : { state: 'chip' }),
                openLink: () => undefined
            }}
        />
    );
}
