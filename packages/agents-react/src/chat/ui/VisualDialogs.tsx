import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatVisual } from '@adecore/agent-contracts';
import { CloseButton, Dialog, ErrorBoundary, PromptDialog } from '@adecore/ui';
import { useChatScope } from '../../scope';
import { useChatRow } from '../../state/chats';
import { useVisualDialog } from '../visuals';
import { VisualFrame } from './VisualFrame';

/*
 * The large view of one of the chat's visuals and the question before one goes, opened from its row.
 * A visual that goes while either is up closes it. Removing cannot be undone: the page is deleted.
 */
export function VisualDialogs({ chatId }: { chatId: string }) {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const key = scope.keyOf(chatId);
    const kind = useVisualDialog((s) => (s.chatKey === key ? s.kind : null));
    const visualId = useVisualDialog((s) => (s.chatKey === key ? s.visualId : null));
    const visual = useChatRow(chatId, (row) => (visualId === null ? null : (row?.visuals?.find((candidate) => candidate.id === visualId) ?? null)));
    // The dialog fades out after it closes, and draws what it showed until then.
    const [shown, setShown] = useState<ChatVisual | null>(visual);
    if (visual !== null && visual !== shown) {
        setShown(visual);
    }
    const close = (): void => useVisualDialog.getState().close();

    return (
        <>
            <Dialog.Root open={kind === 'expand' && visual !== null} onOpenChange={(next) => !next && close()}>
                <Dialog.Popup className="flex h-[calc(100dvh-96px)] w-[1200px] flex-col overflow-hidden">
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border pr-2 pl-4">
                        <Dialog.Title className="min-w-0 grow truncate">{shown?.title}</Dialog.Title>
                        <CloseButton label={t('common.action.close')} kbd="esc" dialog />
                    </div>
                    <div className="relative min-h-0 grow">
                        {shown !== null && (
                            <ErrorBoundary label={t('visuals.renderFailed')} resetKeys={[shown]}>
                                <VisualFrame chatId={chatId} visual={shown} fill />
                            </ErrorBoundary>
                        )}
                    </div>
                </Dialog.Popup>
            </Dialog.Root>
            <PromptDialog
                open={kind === 'remove' && visual !== null}
                title={t('visuals.removeTitle')}
                description={t('visuals.removeDescription', { title: shown?.title ?? '' })}
                confirmLabel={t('common.action.remove')}
                danger
                fallbackMessage={t('visuals.removeFailed')}
                onConfirm={async () => {
                    if (visualId !== null) {
                        await scope.chats.removeVisual(chatId, visualId);
                    }
                    close();
                }}
                onOpenChange={close}
            />
        </>
    );
}
