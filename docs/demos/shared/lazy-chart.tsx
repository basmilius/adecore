export function LazyChart({ bars }: { bars: number[] }) {
    return (
        <div className="flex h-24 items-end gap-1.5">
            {bars.map((height, index) => (
                <span key={index} className="w-6 rounded-t-sm bg-accent" style={{ height: height * 10 }} />
            ))}
        </div>
    );
}
