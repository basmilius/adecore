import { useState } from 'react';
import { SplitView, type SplitLayout } from '@adecore/ui';

const INITIAL: SplitLayout = {
    root: {
        type: 'split',
        id: 'columns',
        axis: 'horizontal',
        sizes: [0.6, 0.4],
        children: [
            { type: 'pane', id: 'canvas', views: ['Canvas'], active: 'Canvas' },
            {
                type: 'split',
                id: 'rows',
                axis: 'vertical',
                sizes: [0.5, 0.5],
                children: [
                    { type: 'pane', id: 'properties', views: ['Properties'], active: 'Properties' },
                    { type: 'pane', id: 'timeline', views: ['Timeline'], active: 'Timeline' }
                ]
            }
        ]
    },
    focused: 'canvas',
    maximized: null
};

export default function SplitViewDemo() {
    const [value, setValue] = useState(INITIAL);
    return (
        <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <SplitView
                value={value}
                onValueChange={setValue}
                showTabs={false}
                layout="roomy"
                renderView={(id) => <div className="grid h-full place-items-center text-sm text-text-muted">{id}</div>}
            />
        </div>
    );
}
