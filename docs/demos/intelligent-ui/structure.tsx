import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { ui } from '../shared/intelligent-ui-tree.ts';

export default function StructureDemo() {
    return (
        <DemoBlock
            nodes={[
                ui(
                    'Tabs',
                    {},
                    ui('Tab', { title: 'Option A' }, 'Keep the cache and raise its limit.'),
                    ui('Tab', { title: 'Option B' }, 'Drop the cache and read from disk.')
                ),
                ui('Sections', {}, ui('Section', { title: 'What changed' }, 'Two files, both in the loader.'), ui('Section', { title: 'Risks' }, 'None found.'))
            ]}
        />
    );
}
