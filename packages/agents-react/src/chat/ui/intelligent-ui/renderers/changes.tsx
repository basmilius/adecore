import type { UiProps } from '@adecore/intelligent-ui';
import { FileIcon, MiddleTruncate, Tooltip } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { uiLinkAction } from '../link-action';
import { uiChildrenOf, uiNodeLabel } from '../node-text';
import type { UiRendererProps } from '../render-context';

export function ChangesRenderer({ node, children }: UiRendererProps<UiProps<'Changes'>>) {
    const { t } = useTranslation('agent-chat');

    return (
        <ul
            aria-label={t('blocks.changes.label', { count: uiChildrenOf(node, 'Change').length })}
            className="chat-ui-nodes chat-ui-flat flex flex-col rounded-xl bg-ui-tile p-1.5"
        >
            {children}
        </ul>
    );
}

/* The share of added against removed lines, drawn only; the two numbers beside it say it in words. */
function ChangeBar({ added, removed }: { added: number; removed: number }) {
    const total = added + removed;

    return (
        <span aria-hidden className="flex h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-track">
            {total > 0 && (
                <>
                    <span className="bg-positive" style={{ width: `${(added / total) * 100}%` }} />
                    <span className="bg-status-error" style={{ width: `${(removed / total) * 100}%` }} />
                </>
            )}
        </span>
    );
}

/*
 * One changed file as a row that opens its diff the way a Diff chip does, once the host says it can. Until
 * then, and for a file it cannot open, the row is text with the reason on its path. The note stands under
 * the row, outside the button, since its prose may hold a link of its own.
 */
export function ChangeRenderer({ node, children, context }: UiRendererProps<UiProps<'Change'>>) {
    const { t } = useTranslation('agent-chat');
    const { path, added, removed, state } = node.props;
    const { open, reason } = uiLinkAction(t, { type: 'Diff', path }, context);
    const counted = added !== undefined || removed !== undefined;

    const name: ReactNode =
        open !== null || reason === null ? (
            <MiddleTruncate text={path} className="min-w-0 grow font-mono text-code text-text" />
        ) : (
            <Tooltip label={reason}>
                <span tabIndex={0} className="min-w-0 grow truncate rounded-sm font-mono text-code text-text-muted">
                    {path}
                </span>
            </Tooltip>
        );

    const row = (
        <>
            <FileIcon path={path} size={14} className="shrink-0" />
            {name}
            {state !== undefined && <span className="shrink-0 text-2xs text-text-muted">{t(`blocks.changes.state.${state}`)}</span>}
            {counted && (
                <>
                    <span className="min-w-8 shrink-0 text-right text-2xs text-positive tabular-nums">
                        <span aria-hidden>+{formatNumber(added ?? 0)}</span>
                        <span className="sr-only">{t('blocks.changes.added', { count: added ?? 0 })}</span>
                    </span>
                    <span className="min-w-8 shrink-0 text-right text-2xs text-status-error tabular-nums">
                        <span aria-hidden>-{formatNumber(removed ?? 0)}</span>
                        <span className="sr-only">{t('blocks.changes.removed', { count: removed ?? 0 })}</span>
                    </span>
                    <ChangeBar added={added ?? 0} removed={removed ?? 0} />
                </>
            )}
        </>
    );

    const shape = 'flex min-h-8.5 w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 text-left text-xs';

    return (
        <li className="flex min-w-0 flex-col">
            {open === null ? (
                <div className={shape}>{row}</div>
            ) : (
                <button type="button" className={clsx(shape, 'hover:bg-text/4')} onClick={open}>
                    {row}
                </button>
            )}
            {uiNodeLabel(node) !== '' && <p className="pr-1.5 pb-1.5 pl-7.5 text-2xs wrap-break-word text-text-muted">{children}</p>}
        </li>
    );
}
