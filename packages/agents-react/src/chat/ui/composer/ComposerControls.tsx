import { useRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ArrowUp, ChevronDown, Play, Plus, Square } from 'lucide-react';
import type { ChatInfo } from '@adecore/agent-contracts';
import { Button, ErrorBoundary, Icon, Menu, Tooltip, type Shortcut } from '@adecore/ui';
import { useChatHost, type ComposerSendAction, type ComposerSendDraft } from '../../../host';
import { useChatScope } from '../../../scope';
import { useProviders } from '../../../state/providers';
import { useAccountChoice } from '../../account-choice';
import type { StashedPrompt } from '../../stash';
import { composerStopLabel } from '../../subagent-list';
import { HostMenuItems } from '../HostMenuItems';
import { StashPicker } from '../Pickers';
import { RunSettings } from '../RunSettings';
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
    /* The host's own, behind a chevron on the send button; empty draws the send button alone. */
    actions: readonly ComposerSendAction[];
    draft: ComposerSendDraft;
}

interface SendButtonProps {
    send: SendProps;
    /* The chevron only follows whether the box takes input: an action may want an empty draft, such as to reuse the last message. */
    writable: boolean;
}

/* The send button, split with a chevron that opens the host's send actions when it has any. */
function SendButton({ send, writable }: SendButtonProps) {
    const { t } = useTranslation('agent-chat');
    const [box, setBox] = useState<HTMLDivElement | null>(null);
    const split = send.actions.length > 0;

    const button = (
        <Tooltip label={send.label} kbd={send.kbd} name>
            <button
                className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center bg-accent text-accent-text hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100',
                    split ? 'focus-visible:-outline-offset-2' : 'rounded-full'
                )}
                disabled={send.disabled}
                onClick={(event) => send.onSend(event.altKey)}
            >
                <Icon icon={ArrowUp} size={16} />
            </button>
        </Tooltip>
    );

    if (!split) {
        return button;
    }

    const { draft } = send;

    return (
        // One round shape that clips both halves, the way a split button of the library draws its frame.
        <div ref={setBox} className="flex h-9 shrink-0 overflow-clip rounded-full">
            {button}
            <Menu.Root>
                <Tooltip label={t('composer.sendActions')} name>
                    <Menu.Trigger
                        render={
                            <button
                                type="button"
                                className='relative flex h-9 w-6 shrink-0 items-center justify-center bg-accent text-accent-text before:absolute before:inset-y-0 before:left-0 before:my-auto before:h-4 before:w-px before:bg-current/30 before:content-[""] hover:brightness-90 focus-visible:-outline-offset-2 disabled:opacity-50 disabled:hover:brightness-100'
                            />
                        }
                        disabled={!writable}
                    >
                        <Icon icon={ChevronDown} size={14} />
                    </Menu.Trigger>
                </Tooltip>
                <Menu.Popup anchor={box} side="top" sideOffset={8} align="end" className="min-w-48">
                    <HostMenuItems actions={send.actions.map((action) => ({ ...action, run: () => action.run(draft) }))} />
                </Menu.Popup>
            </Menu.Root>
        </div>
    );
}

interface ComposerControlsProps {
    chatId: string;
    info: ChatInfo;
    providerFixed: boolean;
    writable: boolean;
    attachable: boolean;
    controls: ChatControls;
    send: SendProps;
    dictationToolbar: Ref<HTMLDivElement>;
    onFiles(files: File[]): void;
    onRestore(prompt: StashedPrompt): void;
    insert(text: string): void;
}

/* The row under the box: attach, the chat's settings, the stash, the app's own control, and stop and send. */
export function ComposerControls({
    chatId,
    info,
    providerFixed,
    writable,
    attachable,
    controls,
    send,
    dictationToolbar,
    onFiles,
    onRestore,
    insert
}: ComposerControlsProps) {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const Slot = useChatHost().ComposerSlot;
    const providers = useProviders((row) => row.providers);
    const accountChoice = useAccountChoice(info.provider, info.account);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const busy = info.activeTurnId !== null;
    const model = providers.find((entry) => entry.kind === info.provider)?.models.find((entry) => entry.slug === info.selection.model);
    // The CLI announces its session on the first message, so anything before that is still a blank chat.
    const started = info.agentSessionId !== null || info.usage.turns > 0;

    // A chat that has started keeps its provider (the CLI holds the thread), and so does one opened for a
    // named CLI; its models stay switchable, since the CLI takes a new one on the restart the next send does.
    const pickable =
        started || providerFixed
            ? providers.filter((entry) => entry.kind === info.provider)
            : providers.filter((entry) => entry.installed && entry.capabilities.chat);

    return (
        // The composer's controls are round, from attach to send, so they keep their own shape instead of `.icon-btn`'s.
        <div className="flex items-center gap-2 pt-3 pr-3.5 pb-3.5 pl-5 @max-md/composer:gap-1.5 @max-md/composer:p-3 @max-md/composer:pt-2.5">
            {attachable && (
                <Tooltip label={t('composer.attach')} name>
                    <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-text-muted hover:bg-surface-hover-edged hover:text-text disabled:opacity-50"
                        disabled={!writable}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Icon icon={Plus} size={16} />
                    </button>
                </Tooltip>
            )}
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
            />
            <StashPicker onRestore={onRestore} />
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
                {send.onContinue === null && send.visible && <SendButton send={send} writable={writable} />}
            </div>
        </div>
    );
}
