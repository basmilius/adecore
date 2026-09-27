import { useState } from 'react';
import { Bookmark, Bug, Flag, Heart, Rocket, Star, Tag, Zap } from 'lucide-react';
import { IconPicker } from '@basmilius/react-ui';

const ICONS = { Bookmark, Bug, Flag, Heart, Rocket, Star, Tag, Zap };

export default function IconPickerDemo() {
    const [icon, setIcon] = useState<string | null>('Rocket');

    return <IconPicker className="w-72" icons={ICONS} value={icon} onValueChange={setIcon} onClear={() => setIcon(null)} />;
}
