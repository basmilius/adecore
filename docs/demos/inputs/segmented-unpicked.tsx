import { Segmented } from '@adecore/ui';
import { Bell, Inbox, ShoppingCart, Tag, User } from 'lucide-react';
import { useState } from 'react';

type Category = 'primary' | 'transactions' | 'updates' | 'promotions' | 'all';

export default function SegmentedUnpicked() {
    const [category, setCategory] = useState<Category>('primary');

    return (
        <Segmented
            label="Category"
            iconOnly="unpicked"
            value={category}
            onValueChange={setCategory}
            options={[
                { id: 'primary', label: 'Primary', icon: User, indicator: true, indicatorLabel: '3 unread' },
                { id: 'transactions', label: 'Transactions', icon: ShoppingCart },
                { id: 'updates', label: 'Updates', icon: Bell, indicator: true, indicatorLabel: '12 unread' },
                { id: 'promotions', label: 'Promotions', icon: Tag },
                { id: 'all', label: 'All mail', icon: Inbox }
            ]}
        />
    );
}
