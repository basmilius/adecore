import { useState } from 'react';
import { Button, ErrorBoundary } from '@adecore/ui';
import { UsageDialog } from '@adecore/agents-react/usage/UsageDialog';
import { UsageLimitsCard } from '@adecore/agents-react/usage/UsageLimitsCard';
import { UsagePage } from '@adecore/agents-react/usage/UsagePage';
import { AgentDemo } from '../shared/agents.tsx';

export default function UsagePageDemo() {
    const [open, setOpen] = useState(false);

    return (
        <AgentDemo>
            <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => setOpen(true)}>
                    Open usage
                </Button>
                <UsageLimitsCard>
                    <Button variant="secondary">Plan limits</Button>
                </UsageLimitsCard>
            </div>
            <UsageDialog open={open} onOpenChange={setOpen}>
                <ErrorBoundary label="Usage">
                    <UsagePage />
                </ErrorBoundary>
            </UsageDialog>
        </AgentDemo>
    );
}
