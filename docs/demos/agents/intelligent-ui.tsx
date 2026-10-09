import { Fragment, useState, type ComponentType, type ReactNode } from 'react';
import { UI_RENDERERS } from '@adecore/agents-react/chat/ui/intelligent-ui/registry';
import type { UiRenderContext, UiRendererProps } from '@adecore/agents-react/chat/ui/intelligent-ui/render-context';
import { UiBlockFrame, type UiBlockFrameProps } from '@adecore/agents-react/chat/ui/intelligent-ui/UiBlockFrame';

type DemoNode = UiBlockFrameProps['nodes'][number];

const text = (id: string, value: string): DemoNode => ({
    id,
    type: '$text',
    props: { text: value },
    bindings: {},
    children: [],
    complete: true,
    fallback: value
});

const node = (id: string, type: string, props: Record<string, unknown>, children: DemoNode[] = [], bindings: DemoNode['bindings'] = {}): DemoNode => ({
    id,
    type,
    props,
    bindings,
    children,
    complete: true,
    fallback: ''
});

/* When a person picked a choice, read in the handler and never while drawing. */
function answeredAt(): number {
    return Date.now();
}

/* What a runtime does, cut down to a fixed tree: text as text, every other node through the registry. */
function drawn(nodes: readonly DemoNode[], context: UiRenderContext): ReactNode {
    return nodes.map((child) => {
        if (child.type === '$text') {
            return <Fragment key={child.id}>{String(child.props.text)}</Fragment>;
        }
        const Renderer = UI_RENDERERS[child.type as keyof typeof UI_RENDERERS] as ComponentType<UiRendererProps<unknown>> | null;
        return Renderer === null ? null : (
            <Renderer key={child.id} node={child} context={context}>
                {drawn(child.children, context)}
            </Renderer>
        );
    });
}

export default function IntelligentUiDemo() {
    const [selected, setSelected] = useState<unknown[]>(['links', 'preload']);
    const [answer, setAnswer] = useState<{ choiceId: string; at: number } | null>(null);
    const binding = { value: selected, onValueChange: (next: unknown) => setSelected(next as unknown[]) };
    const context: UiRenderContext = {
        scopeId: 'demo',
        chatId: 'chat',
        itemId: 'reply',
        blockId: 'review',
        phase: 'final',
        answer: answer === null ? null : { choiceId: answer.choiceId, state: 'sent' },
        link: () => ({ state: 'chip' }),
        openLink: () => undefined,
        onChoose: (choiceId) => setAnswer({ choiceId, at: answeredAt() })
    };
    const nodes: DemoNode[] = [
        node('summary', 'Summary', { tone: 'danger', badge: '2 blocking' }, [text('summary-text', `${selected.length} of 2 findings selected`)]),
        node(
            'list',
            'Checklist',
            { value: selected },
            [
                node('links', 'Item', { value: 'links' }, [
                    node('links-file', 'File', { path: 'src/terminal/links.ts', line: 148 }, [text('links-text', 'Cuts a path at a space')])
                ]),
                node('preload', 'Item', { value: 'preload' }, [
                    node('preload-file', 'File', { path: 'src/preload.ts', line: 62 }, [text('preload-text', 'Bridge method not optional')])
                ])
            ],
            { value: binding }
        ),
        node('stats', 'Stats', {}, [
            node('cold', 'Stat', { label: 'Cold start', value: 1.42, previous: 1.9, unit: 's', tone: 'success' }),
            node('chunk', 'Stat', { label: 'First chunk', value: 812, previous: 790, unit: 'kB' })
        ]),
        node('choices', 'Choices', {}, [
            node('fix', 'Choice', { context: `Fix these findings: ${selected.join(', ')}`, primary: true }, [text('fix-text', `Fix ${selected.length}`)]),
            node('leave', 'Choice', {}, [text('leave-text', 'Leave it')])
        ])
    ];
    const chosen = answer === null ? undefined : nodes.at(-1)!.children.find((choice) => choice.id === answer.choiceId);
    const answered = answer === null || chosen === undefined ? null : { label: String(chosen.children[0]?.props.text), at: answer.at };
    return (
        <div className="w-full max-w-xl">
            <UiBlockFrame nodes={nodes} phase="final" answered={answered}>
                {drawn(nodes, context)}
            </UiBlockFrame>
        </div>
    );
}
