import { useCallback, useRef, useState } from 'react';
import { AGENT_COLORS, type Editor, type EditorAttributionHover } from '@adecore/editor';
import { AttributionCard } from '@adecore/editor-react';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo' } as const;

const RUNS = {
    pricing: { title: 'Pricing agent', subtitle: 'lines 4 to 10', prompt: 'Add up the price of every line of the order.', color: AGENT_COLORS[0] },
    summary: { title: 'Writer', subtitle: 'lines 12 to 15', prompt: 'Describe an order in one sentence.', color: AGENT_COLORS[1] }
} as const;

/* Rest the pointer on a colored bar in the gutter; the card stays while the pointer is on it. */
export default function AttributionCardDemo() {
    const [hover, setHover] = useState<EditorAttributionHover | null>(null);
    const held = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const setup = useCallback((editor: Editor) => {
        editor.setAttributionMarks([
            { id: 'pricing', startLine: 4, endLine: 10, color: RUNS.pricing.color },
            { id: 'summary', startLine: 12, endLine: 15, color: RUNS.summary.color }
        ]);
        const stop = editor.onAttributionHover((next) => {
            clearTimeout(timer.current);
            if (next !== null) {
                setHover(next);
                return;
            }
            // A moment to reach the card before it goes.
            timer.current = setTimeout(() => {
                if (!held.current) {
                    setHover(null);
                }
            }, 250);
        });
        return () => {
            clearTimeout(timer.current);
            stop();
        };
    }, []);
    const { host } = useEditor(OPTIONS, setup);

    const run = hover === null ? null : RUNS[hover.id as keyof typeof RUNS];

    return (
        <>
            <EditorFrame host={host} />
            {hover !== null && run !== null && (
                <AttributionCard
                    rect={hover.rect}
                    title={run.title}
                    subtitle={run.subtitle}
                    prompt={run.prompt}
                    color={run.color}
                    onHold={(inside) => {
                        held.current = inside;
                        if (!inside) {
                            setHover(null);
                        }
                    }}
                />
            )}
        </>
    );
}
