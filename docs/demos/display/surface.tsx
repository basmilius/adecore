import { Surface } from '@basmilius/desktop-ui';

export default function SurfaceDemo() {
    return (
        <div className="relative h-48 w-full max-w-md overflow-hidden rounded-lg bg-surface-sunken">
            <div className="absolute inset-0 grid grid-cols-6 gap-2 p-3">
                {Array.from({ length: 24 }, (_, index) => (
                    <span key={index} className="rounded-md bg-accent-soft" />
                ))}
            </div>
            <Surface className="absolute inset-x-6 bottom-4 rounded-xl px-4 py-3 text-sm text-text">A surface floats over what scrolls under it.</Surface>
        </div>
    );
}
