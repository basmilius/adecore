import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatInfo, ModelInfo } from '@adecore/agent-contracts';
import { useChatScope } from '../../../scope';
import { choiceWord } from '../../../agents/option-words';
import { registerEffortStepper } from '../../composer-effort';
import { EFFORT_OPTION, stepEffort, type EffortStep } from '../../logic/effort';
import type { ChatControls } from './use-chat-controls';
import type { ComposerNotice } from './use-notice';

interface EffortStepperInput {
    chatId: string;
    info: ChatInfo;
    model: ModelInfo | undefined;
    writable: boolean;
    controls: ChatControls;
    setNotice: ComposerNotice['setNotice'];
}

/* Lets a command of the host step this chat's reasoning effort, as picking it in the pill's menu does, and says where it landed. */
export function useEffortStepper({ chatId, info, model, writable, controls, setNotice }: EffortStepperInput): void {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();

    const step = (direction: EffortStep): void => {
        // The pill is disabled then too, and a second configuration would be dropped anyway.
        if (!writable || controls.configurationPending) {
            return;
        }

        const name = model?.name ?? info.selection.model;
        const result = stepEffort(model, info.selection, direction);

        if (result.kind === 'none') {
            setNotice(t('composer.notice.noEffort', { model: name }), 'info');

            return;
        }

        if (result.kind === 'edge') {
            setNotice(
                t(direction === 'up' ? 'composer.notice.effortHighest' : 'composer.notice.effortLowest', {
                    effort: choiceWord(EFFORT_OPTION, result.choice),
                    model: name
                }),
                'info'
            );

            return;
        }

        controls.configure({ selection: result.selection });
        setNotice(t('composer.notice.effort', { effort: choiceWord(EFFORT_OPTION, result.choice) }), 'info');
    };

    // A command means the chat as it stands when it is given, so the registration reads the latest step.
    const stepRef = useRef(step);

    useEffect(() => {
        stepRef.current = step;
    });

    useEffect(() => registerEffortStepper(scope.keyOf(chatId), (direction) => stepRef.current(direction)), [scope, chatId]);
}
