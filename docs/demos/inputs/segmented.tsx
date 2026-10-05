import { useState } from 'react';
import { Columns2, LayoutGrid, List } from 'lucide-react';
import { Segmented } from '@adecore/ui';

type View = 'list' | 'grid' | 'split';

export default function SegmentedDemo() {
    const [view, setView] = useState<View>('list');

    return (
        <Segmented<View>
            label="View"
            value={view}
            onValueChange={setView}
            options={[
                { id: 'list', label: 'List', icon: List },
                { id: 'grid', label: 'Grid', icon: LayoutGrid },
                { id: 'split', label: 'Split', icon: Columns2 }
            ]}
        />
    );
}
