import { Button, PanelEmpty, PanelHeader } from '@adecore/ui';
import { GitPullRequest } from 'lucide-react';

export default function PanelEmptyDemo() {
    return (
        <div className="flex h-72 w-80 flex-col rounded-lg border border-border bg-surface">
            <PanelHeader title="Pull requests" />
            <PanelEmpty
                icon={GitPullRequest}
                action={
                    <Button variant="secondary" size="sm">
                        New pull request
                    </Button>
                }
            >
                No open pull requests on this repository.
            </PanelEmpty>
        </div>
    );
}
