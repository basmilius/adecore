import type { TFunction } from 'i18next';
import { uiReasonText } from './node-text';
import type { UiLink, UiLinkTarget, UiRenderContext } from './render-context';

export const UI_PLAIN_LINK: UiLink = { state: 'plain' };

export function uiBaseName(path: string): string {
    const trimmed = path.replace(/\/+$/, '');

    return trimmed.slice(trimmed.lastIndexOf('/') + 1) || path;
}

/* Why the host leaves a link as text, for its tooltip; null where no host checks links at all. */
export function uiPlainLinkReason(t: TFunction<'agent-chat'>, link: UiLink, context: UiRenderContext): string | null {
    return uiReasonText(t, link.code, link.reason) ?? (context.link === undefined ? null : t('blocks.outsideProject'));
}

/*
 * A link that is a whole row rather than a chip, such as a changed file: `open` once the host can open the
 * target, otherwise the reason it stays text.
 */
export function uiLinkAction(t: TFunction<'agent-chat'>, target: UiLinkTarget, context: UiRenderContext): { open: (() => void) | null; reason: string | null } {
    const link = context.link?.(target) ?? UI_PLAIN_LINK;

    if (link.state === 'plain') {
        return { open: null, reason: uiPlainLinkReason(t, link, context) };
    }

    const { openLink } = context;

    return { open: openLink === undefined ? null : () => openLink(target), reason: null };
}
