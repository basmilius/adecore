import { useState } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { layoutOf, readingOrder, toSvg } from '@adecore/diagram';
import type { DiagramContent, DiagramDirection } from '@adecore/diagram/protocol';
import { Segmented } from '@adecore/ui';
import { THEME_PALETTE, THEME_PAPER } from '../shared/canvas-theme.ts';

const RELEASE: DiagramContent = {
    meta: { title: 'Release', direction: 'right' },
    nodes: [
        { id: 'commit', label: 'Commit', shape: 'pill', tone: 'muted' },
        { id: 'build', label: 'Build', sub: 'bun run build' },
        { id: 'test', label: 'Test', sub: 'bun test' },
        { id: 'approved', label: 'Approved?', shape: 'diamond', tone: 'orange' },
        { id: 'publish', label: 'Publish', shape: 'round', tone: 'green' },
        { id: 'registry', label: 'Registry', shape: 'cylinder', tone: 'blue' },
        { id: 'docs', label: 'Docs site', shape: 'round', tone: 'purple' }
    ],
    groups: [{ id: 'ci', label: 'CI', wraps: ['build', 'test'], tone: 'accent' }],
    edges: [
        { from: 'commit', to: 'build' },
        { from: 'build', to: 'test' },
        { from: 'test', to: 'approved', label: 'green' },
        { from: 'approved', to: 'publish', label: 'yes' },
        { from: 'approved', to: 'commit', label: 'changes', style: 'dashed', tone: 'red' },
        { from: 'publish', to: 'registry' },
        { from: 'publish', to: 'docs', style: 'dotted' }
    ]
};

export default function DiagramLayoutDemo() {
    const [direction, setDirection] = useState<DiagramDirection>('right');
    const content = { ...RELEASE, meta: { ...RELEASE.meta, direction } };
    const layout = layoutOf(content);
    const svg = toSvg(content, { layout, palette: THEME_PALETTE, paper: THEME_PAPER });

    return (
        <div className="flex w-full flex-col gap-4">
            <Segmented<DiagramDirection>
                label="Direction"
                value={direction}
                onValueChange={setDirection}
                options={[
                    { id: 'right', label: 'Right', icon: ArrowRight },
                    { id: 'down', label: 'Down', icon: ArrowDown }
                ]}
                className="self-start"
            />
            <div
                className="flex justify-center [&_svg]:h-auto [&_svg]:max-h-[480px] [&_svg]:w-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
            />
            <ol className="flex flex-col gap-1 font-mono text-code text-text-muted">
                {readingOrder(content).map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ol>
        </div>
    );
}
