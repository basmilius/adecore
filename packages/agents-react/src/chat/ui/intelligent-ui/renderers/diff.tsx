import type { UiProps } from '@adecore/intelligent-ui';
import { Button, LazyBoundary, lazyNamed, Spinner } from '@adecore/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { uiReasonText } from '../node-text';
import { uiClipPatch } from '../patch-clip';
import type { UiDiff, UiLinkTarget, UiRenderContext, UiRendererProps } from '../render-context';
import { LinkRow, UiLinkChip } from './links';

const UnifiedDiff = lazyNamed(() => import('../../UnifiedDiff'), 'default');

/* The lines of change and context an open Diff shows in its block; the whole change opens in the host's own diff. */
export const UI_DIFF_LINES = 200;

/* The tallest the patch stands in its tile, in pixels, past which it scrolls. */
const DIFF_HEIGHT = 320;

function changeKind(patch: string): 'add' | 'update' | 'delete' {
    return /^new file mode /m.test(patch) ? 'add' : /^deleted file mode /m.test(patch) ? 'delete' : 'update';
}

/* The chip of the file and what the agent says about it, with whatever the state adds between them. */
function DiffHead({ chip, described, children }: { chip: ReactNode; described: boolean; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            <span className="flex max-w-full min-w-0 items-center gap-1.5">{chip}</span>
            {described && <span className="min-w-0 wrap-break-word text-text-muted">{children}</span>}
        </div>
    );
}

/*
 * The change of one file as the host read it from git, in a tile headed by the chip a closed Diff is. The
 * block shows the first `UI_DIFF_LINES` lines; past them, or where the host cut the patch itself, a button
 * opens the whole change as the chip does.
 */
function OpenDiff({
    target,
    diff,
    hideWhitespace,
    described,
    context,
    children
}: {
    target: UiLinkTarget & { type: 'Diff' };
    diff: UiDiff & { state: 'patch' };
    hideWhitespace: boolean;
    described: boolean;
    context: UiRenderContext;
    children: ReactNode;
}) {
    const { t } = useTranslation('agent-chat');
    const { patch, clipped } = uiClipPatch(diff.patch, UI_DIFF_LINES);
    const partial = clipped || diff.truncated;
    const { openLink } = context;
    const openable = openLink !== undefined && context.link?.(target).state === 'chip';

    return (
        <figure aria-label={t('blocks.diff.label', { path: target.path })} className="flex min-w-0 flex-col gap-2 rounded-xl bg-ui-tile p-2">
            <figcaption className="px-1 pt-0.5">
                <DiffHead chip={<UiLinkChip target={target} context={context} />} described={described}>
                    {children}
                </DiffHead>
            </figcaption>
            {patch.trim() === '' ? (
                <p className="px-1 pb-0.5 text-xs text-text-muted">{t('blocks.diff.unchanged')}</p>
            ) : (
                <div className="overflow-hidden rounded-lg bg-ui-inset">
                    <LazyBoundary fallback={<div className="px-3 py-2 text-xs text-text-faint">{t('work.loadingDiff')}</div>}>
                        <UnifiedDiff
                            change={{ path: target.path, kind: changeKind(patch), diff: patch }}
                            ignoreWhitespace={hideWhitespace}
                            maxHeight={DIFF_HEIGHT}
                        />
                    </LazyBoundary>
                </div>
            )}
            {partial && (
                <div className="flex flex-wrap items-center gap-2 px-1 pb-0.5 text-2xs text-text-muted">
                    <span>{t('blocks.diff.partial')}</span>
                    {openable && (
                        <Button size="xs" variant="secondary" onClick={() => openLink(target)}>
                            {t('blocks.diff.showAll')}
                        </Button>
                    )}
                </div>
            )}
        </figure>
    );
}

/*
 * A changed file as a chip. With `open` it shows the change itself once the host read it: the chip waits
 * quietly until then, and stays text with the reason where the host would not read it. A host that reads no
 * diffs, a block that still streams and a Diff past the few a block may open leave the chip as it is.
 */
export function DiffRenderer({ node, children, context }: UiRendererProps<UiProps<'Diff'>>) {
    const { t } = useTranslation('agent-chat');
    const { path, open, whitespace } = node.props;
    const target = { type: 'Diff' as const, path };
    const described = node.children.length > 0;
    const diff = open === true ? context.diff?.(node.id) : undefined;

    if (diff === undefined) {
        return (
            <LinkRow target={target} context={context} described={described}>
                {children}
            </LinkRow>
        );
    }

    if (diff.state === 'patch') {
        return (
            <OpenDiff target={target} diff={diff} hideWhitespace={whitespace === 'hide'} described={described} context={context}>
                {children}
            </OpenDiff>
        );
    }

    if (diff.state === 'reading') {
        return (
            <DiffHead
                chip={
                    <>
                        <UiLinkChip target={target} context={context} />
                        <Spinner size={12} label={t('work.loadingDiff')} className="shrink-0 text-text-faint" />
                    </>
                }
                described={described}
            >
                {children}
            </DiffHead>
        );
    }

    return (
        <DiffHead
            chip={<UiLinkChip target={target} context={context} refused={uiReasonText(t, diff.code, diff.reason) ?? t('blocks.diff.unavailable')} />}
            described={described}
        >
            {children}
        </DiffHead>
    );
}
