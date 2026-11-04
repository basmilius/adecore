import { Banner, Button } from '@adecore/ui';
import { TriangleAlert } from 'lucide-react';

export default function BannerInlineDemo() {
    return (
        <div className="flex w-full flex-col gap-3">
            <Banner
                placement="inline"
                icon={TriangleAlert}
                tone="attention"
                message="Request duration hit the limit of 1,000 series. New combinations go to one overflow series."
            >
                <Button size="sm">Show attributes</Button>
            </Banner>
            <div className="h-24 rounded-lg border border-border bg-surface-sunken" />
        </div>
    );
}
