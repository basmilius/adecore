import { ScrollArea } from '@adecore/ui';

const FILES = [
    'README.md',
    'package.json',
    'src/index.ts',
    'src/theme.css',
    'src/ScrollArea.tsx',
    'src/Tooltip.tsx',
    'src/IconButton.tsx',
    'src/format/date.ts'
];

const LINES = Array.from(
    { length: 40 },
    (_, index) => `${String(index + 1).padStart(3)}  export function step${index}(input: Input, options: Options) { return run(input, options); }`
);

export default function ScrollAreaDemo() {
    return (
        <div className="grid w-full gap-4 md:grid-cols-2">
            <ScrollArea render={<ul />} aria-label="Files" className="h-60 rounded-lg border border-border bg-surface" viewportClassName="py-1">
                {Array.from({ length: 60 }, (_, index) => (
                    <li key={index} className="flex gap-2.5 px-3.5 py-1 text-sm text-text">
                        <span className="w-7 shrink-0 text-right text-text-faint tabular-nums">{index + 1}</span>
                        {FILES[index % FILES.length]}
                    </li>
                ))}
            </ScrollArea>
            <ScrollArea
                axis="both"
                render={<pre />}
                className="h-60 rounded-lg border border-border bg-surface"
                viewportClassName="px-3.5 py-2.5 font-mono text-code text-text-muted"
            >
                {LINES.join('\n')}
            </ScrollArea>
        </div>
    );
}
