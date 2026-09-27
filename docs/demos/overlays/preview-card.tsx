import { PreviewCard } from '@basmilius/react-ui';

export default function PreviewCardDemo() {
    return (
        <p className="max-w-md text-sm text-text-muted">
            The fix landed in{' '}
            <PreviewCard.Root>
                <PreviewCard.Trigger href="https://github.com/basmilius/react-ui" className="font-medium text-accent underline">
                    #128
                </PreviewCard.Trigger>
                <PreviewCard.Popup className="w-72 p-3">
                    <p className="text-sm font-medium text-text">Keep a nested dialog above its parent</p>
                    <p className="mt-1 text-xs text-text-muted">Merged two days ago, 3 files changed.</p>
                </PreviewCard.Popup>
            </PreviewCard.Root>{' '}
            after a week of review.
        </p>
    );
}
