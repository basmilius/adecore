import { Inbox, LoaderCircle } from 'lucide-react';
import { Button, EmptyState } from '@basmilius/react-ui';

export default function EmptyStateDemo() {
    return (
        <div className="grid w-full max-w-xl grid-cols-2 gap-4">
            <EmptyState
                icon={Inbox}
                action={
                    <Button variant="secondary" size="sm">
                        Create a task
                    </Button>
                }
                className="rounded-lg border border-border bg-surface"
            >
                No tasks yet. A task you create shows up here.
            </EmptyState>
            <EmptyState icon={LoaderCircle} spin title="Indexing" className="rounded-lg border border-border bg-surface">
                Reading 1,204 files. Search works once this is done.
            </EmptyState>
        </div>
    );
}
