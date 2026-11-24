import { ui } from '../shared/intelligent-ui-tree.ts';
import { DemoBlock } from '../shared/intelligent-ui.tsx';

export default function ContentDemo() {
    return (
        <DemoBlock
            nodes={[
                ui('CodeBlock', { language: 'ts' }, 'export const retries = 3;'),
                ui('CodeBlock', { file: 'src/total.ts', start: 12, highlight: [13] }, 'const rows = await read();\nconst total = rows.length;'),
                ui(
                    'Sources',
                    {},
                    ui('Source', { title: 'Node.js release schedule', url: 'https://nodejs.org/en/about/previous-releases' }),
                    ui('Source', { title: 'Bun runtime', url: 'https://bun.sh/docs' })
                )
            ]}
            context={{ openUrl: () => undefined, link: () => ({ state: 'chip' }), openLink: () => undefined }}
        />
    );
}
