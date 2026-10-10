import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { ui } from '../shared/intelligent-ui-tree.ts';

export default function DataDemo() {
    return (
        <DemoBlock
            nodes={[
                ui(
                    'Stats',
                    {},
                    ui('Stat', { label: 'Cold start', value: 1.42, previous: 1.9, unit: 's', tone: 'success' }),
                    ui('Stat', { label: 'Bundle', value: 812, unit: 'kB' })
                ),
                ui('EntityList', {}, ui('Entry', { label: 'Branch' }, 'main'), ui('Entry', { label: 'Runner' }, 'macOS arm64')),
                ui(
                    'Table',
                    {
                        rows: [
                            { file: 'src/app.ts', size: 48213, time: 1250 },
                            { file: 'src/chat.ts', size: 31877, time: 830 }
                        ]
                    },
                    ui('Column', { key: 'file', title: 'File', as: 'file' }),
                    ui('Column', { key: 'size', title: 'Size', as: 'bytes' }),
                    ui('Column', { key: 'time', title: 'Build time', as: 'duration' })
                ),
                ui('Chart', {
                    kind: 'bar',
                    unit: 's',
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
