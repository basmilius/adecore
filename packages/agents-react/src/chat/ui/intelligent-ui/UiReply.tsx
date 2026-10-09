import { Component, Fragment, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateUiBlock, isUiComponent, UI_CATALOG_VERSION, UiState, type UiBlock, type UiViewNode } from '@adecore/intelligent-ui';
import { ErrorBoundary } from '@adecore/ui';
import { ReplyMarkdown } from '../Markdown';
import { UI_RENDERERS } from './registry';
import type { UiRenderContext, UiRenderer } from './render-context';
import { UiBlockFrame } from './UiBlockFrame';
import { UiFallbackPart } from './UiFallbackPart';
import { uiReplyParts } from './reply-parts';

const localStates = new Map<string, UiState>();

interface UiNodeBoundaryProps {
    node: UiViewNode;
    children: ReactNode;
}

interface UiNodeBoundaryState {
    failed: boolean;
    node: UiViewNode;
}

class UiNodeBoundary extends Component<UiNodeBoundaryProps, UiNodeBoundaryState> {
    state = { failed: false, node: this.props.node };

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    static getDerivedStateFromProps(props: UiNodeBoundaryProps, state: UiNodeBoundaryState): UiNodeBoundaryState | null {
        return props.node === state.node ? null : { failed: false, node: props.node };
    }

    render(): ReactNode {
        return this.state.failed ? <UiFallbackPart fallback={this.props.node.fallback} problem={{ kind: 'failed' }} /> : this.props.children;
    }
}

function UiNodeBody({ node, context }: { node: UiViewNode; context: UiRenderContext }): ReactNode {
    if (node.type === '$text') {
        return String(node.props.text ?? '');
    }
    if (node.error !== undefined) {
        return <UiFallbackPart fallback={node.fallback} problem={{ kind: 'failed' }} />;
    }
    if (!isUiComponent(node.type)) {
        return <UiFallbackPart fallback={node.fallback} problem={{ kind: 'unknown', component: node.type }} />;
    }
    const Renderer = UI_RENDERERS[node.type] as UiRenderer<Record<string, unknown>> | null;
    if (Renderer === null) {
        return null;
    }
    return (
        <Renderer node={node} context={context}>
            {node.children.map((child) => (
                <UiNodeBoundary key={child.id} node={child}>
                    <UiNodeBody node={child} context={context} />
                </UiNodeBoundary>
            ))}
        </Renderer>
    );
}

function UiBlockBody({ block, context }: { block: UiBlock; context: UiRenderContext }): ReactNode {
    const { t } = useTranslation('agent-chat');
    const key = JSON.stringify([context.scopeId, context.chatId, context.itemId, block.id]);
    let state = localStates.get(key);
    if (!state) {
        state = new UiState(block);
        localStates.set(key, state);
    }
    state.sync(block);
    useSyncExternalStore(
        (listener) => state.subscribe(listener),
        () => state.snapshot(),
        () => state.snapshot()
    );
    const evaluation = evaluateUiBlock(block, state);
    const unknown = block.catalogVersion !== UI_CATALOG_VERSION;
    const failed = !unknown && !block.nodes.length && block.diagnostics.length > 0;
    const shownAsText = unknown ? t('blocks.unreadable') : failed ? block.diagnostics[0].message : undefined;
    return (
        <UiBlockFrame nodes={evaluation.nodes} phase={context.phase} fixes={[...block.diagnostics, ...evaluation.diagnostics]} shownAsText={shownAsText}>
            {unknown || failed ? (
                <ReplyMarkdown text={block.fallback} streaming={false} />
            ) : (
                evaluation.nodes.map((node) => (
                    <UiNodeBoundary key={node.id} node={node}>
                        <UiNodeBody node={node} context={context} />
                    </UiNodeBoundary>
                ))
            )}
        </UiBlockFrame>
    );
}

export function UiReply({
    text,
    blocks,
    context,
    reply
}: {
    text: string;
    blocks: readonly UiBlock[];
    context: Omit<UiRenderContext, 'blockId'>;
    reply?: ComponentProps<typeof ReplyMarkdown>['reply'];
}): ReactNode {
    return uiReplyParts(text, blocks, context.phase === 'streaming').map((part, index) =>
        part.kind === 'text' ? (
            <Fragment key={`text:${index}`}>
                <ReplyMarkdown text={part.text} streaming={context.phase === 'streaming'} reply={reply} />
            </Fragment>
        ) : (
            <ErrorBoundary key={part.block.id} label="UI block" resetKeys={[context.scopeId, context.chatId, context.itemId, part.block.id]}>
                <UiBlockBody block={part.block} context={{ ...context, blockId: part.block.id }} />
            </ErrorBoundary>
        )
    );
}
