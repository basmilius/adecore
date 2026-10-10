import { useState } from 'react';
import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { bound, ui } from '../shared/intelligent-ui-tree.ts';

export default function IntelligentUiDemo() {
    const [selected, setSelected] = useState<unknown[]>(['links', 'preload']);
    return (
        <DemoBlock
            nodes={[
                ui('Summary', { tone: 'danger', badge: '2 blocking' }, `${selected.length} of 2 findings selected`),
                bound(
                    ui(
                        'Checklist',
                        {},
                        ui('Item', { value: 'links' }, ui('File', { path: 'src/terminal/links.ts', line: 148 }, 'Cuts a path at a space')),
                        ui('Item', { value: 'preload' }, ui('File', { path: 'src/preload.ts', line: 62 }, 'Bridge method not optional'))
                    ),
                    selected,
                    (next) => setSelected(next as unknown[])
                ),
                ui(
                    'Stats',
                    {},
                    ui('Stat', { label: 'Cold start', value: 1.42, previous: 1.9, unit: 's', tone: 'success' }),
                    ui('Stat', { label: 'First chunk', value: 812, previous: 790, unit: 'kB' })
                ),
                ui(
                    'Choices',
                    {},
                    ui('Choice', { context: `Fix these findings: ${selected.join(', ')}`, primary: true }, `Fix ${selected.length}`),
                    ui('Choice', {}, 'Leave it')
                )
            ]}
            context={{ link: () => ({ state: 'chip' }), openLink: () => undefined }}
        />
    );
}
