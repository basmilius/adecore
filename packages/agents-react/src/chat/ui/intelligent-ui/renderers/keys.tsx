import type { UiProps } from '@adecore/intelligent-ui';
import { KeyCap } from '@adecore/ui';
import { useChatHost } from '../../../../host/host';
import { uiKeyCaps } from '../key-caps';
import { uiNodeLabel } from '../node-text';
import type { UiRendererProps } from '../render-context';

/* Inline, so a shortcut stands in the sentence that names it. */
export function KeysRenderer({ node }: UiRendererProps<UiProps<'Keys'>>) {
    const host = useChatHost();
    const caps = uiKeyCaps(uiNodeLabel(node), host.isApplePlatform());

    if (caps.length === 0) {
        return null;
    }

    return (
        <span className="mx-0.5 inline-flex items-center gap-0.5 align-middle">
            {caps.map((cap, index) => (
                <KeyCap key={`${cap}-${index}`} size="sm">
                    {cap}
                </KeyCap>
            ))}
        </span>
    );
}
