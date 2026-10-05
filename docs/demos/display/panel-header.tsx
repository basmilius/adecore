import { Filter, RefreshCw } from 'lucide-react';
import { ButtonGroup, CloseButton, IconButton, PanelHeader, Separator } from '@adecore/ui';

export default function PanelHeaderDemo() {
    return (
        <div className="w-80 rounded-lg border border-border bg-surface">
            <PanelHeader title="Changes">
                <span className="grow" />
                <ButtonGroup>
                    <IconButton icon={Filter} label="Filter" size="sm" />
                    <IconButton icon={RefreshCw} label="Refresh" size="sm" />
                </ButtonGroup>
                <Separator />
                <CloseButton label="Close changes" size="sm" onClick={() => {}} />
            </PanelHeader>
            <p className="p-3 text-xs text-text-muted">Nothing changed since the last commit.</p>
        </div>
    );
}
