import { useState } from 'react';
import { Button, ColorSwatch, Menu } from '@basmilius/react-ui';

const LAYOUTS = ['Columns', 'Rows', 'Grid'];

const COLORS = ['#2563eb', '#7c3aed', '#e11d48', '#16a34a'];

export default function MenuCheckDemo() {
    const [layout, setLayout] = useState('Columns');
    const [color, setColor] = useState(COLORS[0]);

    return (
        <Menu.Root>
            <Menu.Trigger render={<Button variant="secondary" />}>Layout</Menu.Trigger>
            <Menu.Popup align="center">
                {LAYOUTS.map((entry) => (
                    <Menu.Item key={entry} closeOnClick={false} onClick={() => setLayout(entry)}>
                        <Menu.Check kind="radio" checked={layout === entry} />
                        {entry}
                    </Menu.Item>
                ))}
                <Menu.Separator />
                <Menu.Label>Color</Menu.Label>
                <div className="flex gap-2 px-2.5 py-1.5">
                    {COLORS.map((swatch) => (
                        <ColorSwatch key={swatch} aria-label={swatch} color={swatch} picked={color === swatch} on="popup" onClick={() => setColor(swatch)} />
                    ))}
                </div>
            </Menu.Popup>
        </Menu.Root>
    );
}
