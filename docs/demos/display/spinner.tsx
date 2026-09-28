import { Spinner, Tooltip } from '@basmilius/react-ui';

export default function SpinnerDemo() {
    return (
        <div className="flex items-end gap-6 text-text-muted">
            {[12, 14, 16, 20].map((size) => (
                <span key={size} className="flex flex-col items-center gap-2 text-xs">
                    <Spinner size={size} />
                    {size}
                </span>
            ))}
            <span className="flex items-center gap-2 text-sm text-text">
                Indexing
                <Tooltip label="Running">
                    <Spinner size={12} label="Running" className="text-accent" />
                </Tooltip>
            </span>
        </div>
    );
}
