import { ui } from '../shared/intelligent-ui-tree.ts';
import { DemoBlock } from '../shared/intelligent-ui.tsx';

export default function DataDemo() {
    return (
        <DemoBlock
            nodes={[
                ui(
                    'Stats',
                    {},
                    ui('Stat', { label: 'Cold start', value: 1.42, previous: 1.9, unit: 's', tone: 'success', trend: [1.9, 1.84, 1.71, 1.52, 1.42] }),
                    ui('Stat', { label: 'Bundle', value: 812, unit: 'kB' })
                ),
                ui(
                    'EntityList',
                    {},
                    ui('Entry', { label: 'Branch' }, 'main'),
                    ui('Entry', { label: 'Runner' }, 'macOS arm64'),
                    ui('Entry', { label: 'Took', as: 'duration' }, '262000')
                ),
                ui(
                    'Table',
                    {
                        sort: 'size desc',
                        rows: [
                            { file: 'src/chat.ts', size: 31877, time: 830, state: 'passed' },
                            { file: 'src/app.ts', size: 48213, time: 1250, state: 'failed' }
                        ]
                    },
                    ui('Column', { key: 'file', title: 'File', as: 'file' }),
                    ui('Column', { key: 'size', title: 'Size', as: 'bytes' }),
                    ui('Column', { key: 'time', title: 'Build time', as: 'duration' }),
                    ui('Column', { key: 'state', title: 'State', as: 'tag', tones: { passed: 'success', failed: 'danger' } })
                ),
                ui('Chart', {
                    kind: 'bar',
                    unit: 's',
                    title: 'Seconds per day',
                    data: [
                        { label: 'Mon', build: 41, test: 63 },
                        { label: 'Tue', build: 38, test: 59 },
                        { label: 'Wed', build: 44, test: 71 }
                    ]
                })
            ]}
        />
    );
}
