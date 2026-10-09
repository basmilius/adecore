import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import type { UiProps } from '@adecore/intelligent-ui';
import { chatHost } from '../../../../host';
import { CodeBlock } from '../../CodeBlock';
import { CodeStreamingContext } from '../../code-streaming';
import { ImageThumb } from '../../ImageView';
import { uiChildrenOf, uiNodeLabel, uiNodeText } from '../node-text';
import type { UiRendererProps } from '../render-context';

// The number of every source by its node id, which the list counts in its own order.
const SourceNumbers = createContext<ReadonlyMap<string, number>>(new Map());

/* Plain text in the same measure until the node closes, so highlighting never makes it jump. */
export function CodeBlockRenderer({ node }: UiRendererProps<UiProps<'CodeBlock'>>) {
    return (
        <CodeStreamingContext.Provider value={!node.complete}>
            <CodeBlock code={uiNodeText(node).replace(/^\n|\n$/g, '')} lang={node.props.language ?? 'text'} />
        </CodeStreamingContext.Provider>
    );
}

/* Its own component, so the host's hook is only called for an image that names an attachment. */
function AttachedImage({ scopeId, chatId, attachmentId, alt }: { scopeId: string; chatId: string; attachmentId: string; alt: string }) {
    const source = chatHost().attachments.useUrl(scopeId, chatId, attachmentId);
    return <ImageThumb source={source} alt={alt} className="max-h-70 max-w-full object-contain" />;
}

/*
 * An attachment of the chat, never a path or an address the model wrote. An image of the latest
 * generation stays a quiet square until the daemon resolved it to an attachment.
 */
export function ImageRenderer({ node, children, context }: UiRendererProps<UiProps<'Image'>>) {
    const { t } = useTranslation('agent-chat');
    const { attachment, alt } = node.props;
    const caption = uiNodeLabel(node);
    const name = alt ?? (caption === '' ? t('blocks.image.label') : caption);
    return (
        <figure className="flex flex-col items-start gap-1.5">
            {attachment === undefined ? (
                <ImageThumb source={{ url: null, failure: t('blocks.image.unavailable') }} alt={name} />
            ) : (
                <AttachedImage scopeId={context.scopeId} chatId={context.chatId} attachmentId={attachment} alt={name} />
            )}
            {caption !== '' && <figcaption className="px-2 text-xs text-text-muted">{children}</figcaption>}
        </figure>
    );
}

export function SourcesRenderer({ node, children }: UiRendererProps<UiProps<'Sources'>>) {
    const { t } = useTranslation('agent-chat');
    const numbers = new Map(uiChildrenOf(node, 'Source').map((source, index) => [source.id, index + 1]));
    return (
        <SourceNumbers value={numbers}>
            <section aria-label={t('blocks.sources')} className="flex flex-col">
                <span className="px-2 pb-1 text-xs font-medium text-text-muted">{t('blocks.sources')}</span>
                <ol className="chat-ui-nodes flex flex-col">{children}</ol>
            </section>
        </SourceNumbers>
    );
}

function domainOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

/* Opens through the host and loads nothing before, not even an icon. */
export function SourceRenderer({ node, context }: UiRendererProps<UiProps<'Source'>>) {
    const number = useContext(SourceNumbers).get(node.id);
    const { title, url } = node.props;
    const { openUrl } = context;
    const face = (
        <>
            <span className="w-5 shrink-0 text-right text-text-faint tabular-nums">{number}</span>
            <span className="min-w-0 truncate text-text">{title}</span>
            <span className="shrink-0 text-text-faint">{domainOf(url)}</span>
        </>
    );
    return (
        <li>
            {openUrl === undefined ? (
                <span className="flex h-8 items-center gap-2 px-2 text-xs">{face}</span>
            ) : (
                <button
                    type="button"
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-surface-hover"
                    onClick={() => openUrl(url)}
                >
                    {face}
                </button>
            )}
        </li>
    );
}
