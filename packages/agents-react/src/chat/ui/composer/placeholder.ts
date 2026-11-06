import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHostComposerPlaceholder } from '../../../host/host-hooks';
import { useChatScope } from '../../../scope';

interface PlaceholderHint {
    key: string;
    label: string;
}

interface HintConditions {
    mentionable: boolean;
    referable: boolean;
    hasSkills: boolean;
}

/* The keys that open a picker in this chat, in the order a person reads them. */
export function placeholderHints(t: TFunction<'agent-chat'>, { mentionable, referable, hasSkills }: HintConditions): PlaceholderHint[] {
    return [
        { key: '/', label: t('composer.placeholder.commands') },
        ...(mentionable ? [{ key: '@', label: t('composer.placeholder.files') }] : []),
        ...(referable ? [{ key: '#', label: t('composer.placeholder.references') }] : []),
        ...(hasSkills ? [{ key: '$', label: t('composer.placeholder.skills') }] : [])
    ];
}

/* The empty box names its sigils as key caps, so they read as keys to press rather than as punctuation. */
function hintedPlaceholder(lead: string, joiner: string, hints: ReadonlyArray<PlaceholderHint>): HTMLElement {
    const root = document.createElement('span');
    root.className = 'composer-hints';
    const extra = document.createElement('span');
    extra.className = 'composer-hints-extra';
    extra.append(joiner);

    for (const hint of hints) {
        const pair = document.createElement('span');
        pair.className = hint.key === '#' ? 'composer-hint composer-hint-references' : 'composer-hint';
        const cap = document.createElement('kbd');
        cap.textContent = hint.key;
        pair.append(cap, hint.label);
        extra.append(pair);
    }

    root.append(lead, extra);

    return root;
}

interface PlaceholderInput extends HintConditions {
    chatId: string;
    disabled: boolean;
    readOnly: boolean;
}

/* What the empty box says: why nothing can be written, or the host's words and the keys that open a picker. */
export function useHintedPlaceholder({ chatId, disabled, readOnly, mentionable, referable, hasSkills }: PlaceholderInput): string | HTMLElement {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const lead = useHostComposerPlaceholder(scope.id, chatId);

    return useMemo(() => {
        if (disabled) {
            return t('composer.placeholder.disconnected');
        }

        if (readOnly) {
            return t('composer.placeholder.readOnly');
        }

        return hintedPlaceholder(
            lead ?? t('composer.placeholder.lead'),
            t('composer.placeholder.joiner'),
            placeholderHints(t, { mentionable, referable, hasSkills })
        );
    }, [disabled, readOnly, lead, mentionable, referable, hasSkills, t]);
}
