import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { ui } from '../shared/intelligent-ui-tree.ts';

export default function ContentDemo() {
    return (
        <DemoBlock
            nodes={[
                ui('CodeBlock', { language: 'ts' }, 'export const retries = 3;'),
                ui(
                    'Sources',
                    {},
                    ui('Source', { title: 'Node.js release schedule', url: 'https://nodejs.org/en/about/previous-releases' }),
                    ui('Source', { title: 'Bun runtime', url: 'https://bun.sh/docs' })
                )
            ]}
            context={{ openUrl: () => undefined }}
        />
    );
}
