import { useState } from 'react';
import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { bound, ui } from '../shared/intelligent-ui-tree.ts';

export default function InputsDemo() {
    const [selected, setSelected] = useState<unknown>(['links']);
    const [notify, setNotify] = useState<unknown>(false);
    const [limit, setLimit] = useState<unknown>(20);
    const [scope, setScope] = useState<unknown>('failed');
    // A Button's action runs on the block's state; here it puts the demo's values back.
    const reset = {
        ...ui('Button', {}, 'Reset'),
        onAction: () => {
            setSelected(['links']);
            setNotify(false);
            setLimit(20);
            setScope('failed');
        }
    };
    return (
        <DemoBlock
            nodes={[
                bound(
                    ui(
                        'Checklist',
                        {},
                        ui('Item', { value: 'links' }, 'Fix the link parser'),
                        ui('Item', { value: 'preload' }, 'Make the bridge method optional')
                    ),
                    selected,
                    setSelected
                ),
                bound(ui('Switch', {}, 'Notify me when it lands'), notify, setNotify),
                bound(ui('Slider', { min: 10, max: 100, step: 10, unit: 'runs' }, 'Runs to compare'), limit, setLimit),
                bound(ui('Segmented', {}, ui('Option', { value: 'failed' }, 'Failed'), ui('Option', { value: 'all' }, 'All')), scope, setScope),
                reset
            ]}
        />
    );
}
