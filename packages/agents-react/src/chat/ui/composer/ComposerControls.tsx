import { holdsConversation } from '@adecore/agent-contracts';
import { Button, ErrorBoundary, Icon, Tooltip, type Shortcut } from '@adecore/ui';
import { ArrowUp, Play, Square } from 'lucide-react';
import { useRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatThreadInfo } from '../../../chat-sink';
import { useChatHost } from '../../../host/host';
import { useChatScope } from '../../../scope';
import { useProviders } from '../../../state/providers';
import { useAccountChoice, useAccountColorId } from '../../account-choice';
import type { StashedPrompt } from '../../stash';
import { composerStopLabel } from '../../subagent-list';
import { RunSettings } from '../RunSettings';
import { ComposerPlusMenu, type PlusMenuSigils } from './ComposerPlusMenu';
import type { ChatControls } from './use-chat-controls';

interface SendProps {
    /* Absent while a turn runs and the box is empty, when the stop button stands alone. */
    visible: boolean;
    disabled: boolean;
    label: string;
    kbd: Shortcut;
    onSend(alternate: boolean): void;
    /* Set when a person stopped the last turn and the box is empty: Continue stands where the send button would. */
    onContinue: (() => void) | null;
}

function SendButton({ send }: { send: SendProps }) {
    return (
        <Tooltip label={send.label} kbd={send.kbd} name>
            <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
                disabled={send.disabled}
                onClick={(event) => send.onSend(event.altKey)}
            >
                <Icon icon={ArrowUp} size={16} />
            </button>
        </Tooltip>
    );
}

interface ComposerControlsProps {
    chatId: string;
    info: ChatThreadInfo;
    providerFixed: boolean;
    writable: boolean;
    attachable: boolean;
    emptyDraft: boolean;
    sigils: PlusMenuSigils;
    controls: ChatControls;
    send: SendProps;
    dictationToolbar: Ref<HTMLDivElement>;
    onFiles(files: File[]): void;
    onRestore(prompt: StashedPrompt): void;
    onStash(): void;
    onSigil(sigil: string): void;
    insert(text: string): void;
}

export function ComposerControls({
    chatId,
    info,
    providerFixed,
    writable,
    attachable,
    emptyDraft,
    sigils,
    controls,
    send,
    dictationToolbar,
    onFiles,
    onRestore,
    onStash,
    onSigil,
    insert
}: ComposerControlsProps) {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const Slot = useChatHost().ComposerSlot;
    const providers = useProviders((row) => row.providers);
    const accountChoice = useAccountChoice(info.provider, info.account, chatId);
    const accountColorId = useAccountColorId(info.provider, info.account);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const busy = info.activeTurnId !== null;
    const model = providers.find((entry) => entry.kind === info.provider)?.models.find((entry) => entry.slug === info.selection.model);
    const started = holdsConversation(info);

    // A chat that has started keeps its provider (the CLI holds the thread), and so does one opened for a
    // named CLI; its models stay switchable, since the CLI takes a new one on the restart the next send does.
    const pickable =
        started || providerFixed
            ? providers.filter((entry) => entry.kind === info.provider)
            : providers.filter((entry) => entry.installed && entry.capabilities.chat);

    return (
        // The composer's controls are round, from attach to send, so they keep their own shape instead of `.icon-btn`'s.
        <div className="flex items-center gap-2 pt-3 pr-3.5 pb-3.5 pl-5 @max-md/composer:gap-1.5 @max-md/composer:p-3 @max-md/composer:pt-2.5">
            <ComposerPlusMenu
                writable={writable}
                attachable={attachable}
                emptyDraft={emptyDraft}
                sigils={sigils}
                onAttach={() => fileInputRef.current?.click()}
                onRestore={onRestore}
                onStash={onStash}
                onSigil={onSigil}
            />
            <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    onFiles(Array.from(e.target.files ?? []));
                    e.target.value = '';
                }}
            />
            <RunSettings
                disabled={controls.configurationPending || !writable}
                providers={pickable}
                provider={info.provider}
                selection={info.selection}
                model={model}
                runtimeMode={info.runtimeMode}
                effectiveRuntimeMode={info.effectiveRuntimeMode}
                permissionMode={info.permissionMode}
                open={controls.modelPickerOpen}
                onOpenChange={controls.setModelPickerOpen}
                onModel={controls.chooseModel}
                onOption={(id, value) => controls.configure({ selection: { ...info.selection, options: { ...info.selection.options, [id]: value } } })}
                onMode={(runtimeMode) => controls.configure({ runtimeMode })}
                usage={info.usage}
                compactDisabled={busy || !writable}
                onCompact={controls.compact}
                account={accountChoice === null ? null : { choice: accountChoice, started, onPick: controls.chooseAccount }}
                {...(accountColorId === undefined ? {} : { accountColorId })}
            />
            {Slot !== null && (
                <ErrorBoundary label={t('composer.slotFailed')} resetKeys={[chatId]} compact className="relative rounded-lg">
                    <Slot scopeId={scope.id} chatId={chatId} disabled={!writable} insert={insert} />
                </ErrorBoundary>
            )}
            <span className="grow" />
            <div className="flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-surface-hover">
                <div ref={dictationToolbar} className="flex items-center pl-1 empty:hidden [&_.icon-btn]:rounded-full" />
                {busy && (
                    <Tooltip label={composerStopLabel()} name>
                        <button
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-error text-accent-text"
                            onClick={(event) => controls.stop(event.shiftKey)}
                        >
                            <Icon icon={Square} size={16} />
                        </button>
                    </Tooltip>
                )}
                {send.onContinue !== null && (
                    <Tooltip label={t('composer.continueHint')}>
                        <Button variant="primary" shape="pill" disabled={controls.configurationPending} onClick={send.onContinue}>
                            <Icon icon={Play} size={14} />
                            {t('composer.continue')}
                        </Button>
                    </Tooltip>
                )}
                {send.onContinue === null && send.visible && <SendButton send={send} />}
            </div>
        </div>
    );
}
