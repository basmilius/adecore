import { Skeleton } from '@basmilius/desktop-ui';

export default function SkeletonDemo() {
    return (
        <div className="flex w-72 flex-col gap-2">
            <Skeleton className="w-40" />
            <Skeleton className="w-full" />
            <Skeleton className="w-3/4" />
            <Skeleton className="mt-2 h-20 w-full rounded-lg" />
        </div>
    );
}
