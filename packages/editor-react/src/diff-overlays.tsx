import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { Editor, EditorEngine } from '@adecore/editor';
import type { DiffDisplay } from '@adecore/merge';
import { RowHost, LineActionHost } from './row-host.ts';

export interface MountedDiff {
    engine: EditorEngine;
    editor: Editor;
    rows: RowHost;
    actions: LineActionHost;
}

export function DiffOverlays({
    mounted,
    display,
    unfold,
    blocked
}: {
    mounted: MountedDiff;
    display: DiffDisplay;
    unfold(id: number): void;
    blocked?: ReadonlySet<number>;
}) {
    const { t } = useTranslation('editor');

    const getRows = () => mounted.rows.getContainers();
    const getActions = () => mounted.actions.getContainers();

    const rows = useSyncExternalStore((listener) => mounted.rows.subscribe(listener), getRows, getRows);
    const actions = useSyncExternalStore((listener) => mounted.actions.subscribe(listener), getActions, getActions);

    return (
        <>
            {display.gaps.map(({ row }) => {
                const container = rows.get(`gap-${row.id}`);

                if (container === undefined) {
                    return null;
                }

                const text = t('diff.hidden', { count: formatNumber(Math.max(row.oldCount, row.newCount)) });

                return createPortal(
                    <div className="adecore-editor-diff-gap">
                        {row.unfoldable && blocked?.has(row.id) === true ? (
                            <Tooltip label={t('diff.contextLimit')}>
                                {/* A disabled button gets no pointer events, so the hint hangs on a wrapper. */}
                                <span className="inline-flex">
                                    <Button size="xs" disabled>
                                        {text}
                                    </Button>
                                </span>
                            </Tooltip>
                        ) : row.unfoldable ? (
                            <Button size="xs" onClick={() => unfold(row.id)}>
                                {text}
                            </Button>
                        ) : (
                            <span>{text}</span>
                        )}
                    </div>,
                    container,
                    `gap-${row.id}`
                );
            })}
            {display.rows.map((row, index) => {
                if (row.noNewline === undefined) {
                    return null;
                }

                const container = actions.get(`no-newline-${index}`);

                return container === undefined
                    ? null
                    : createPortal(<span className="adecore-editor-diff-no-newline">{t('diff.noNewline')}</span>, container, `no-newline-${index}`);
            })}
        </>
    );
}
