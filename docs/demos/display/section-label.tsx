import { ListRow, SectionLabel } from '@adecore/ui';

export default function SectionLabelDemo() {
    return (
        <div className="flex w-64 flex-col gap-1 rounded-lg border border-border bg-surface p-2">
            <SectionLabel render={<h3 />} className="px-2 pt-1">
                Recent projects
            </SectionLabel>
            <ListRow variant="inset" className="text-sm text-text">
                Website
            </ListRow>
            <ListRow variant="inset" className="text-sm text-text">
                Mobile app
            </ListRow>
        </div>
    );
}
