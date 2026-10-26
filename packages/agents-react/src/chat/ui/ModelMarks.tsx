import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import type { ModelInfo } from '@adecore/agent-contracts';
import { Icon, Pill, Tooltip } from '@adecore/ui';

/* What a model row says beside the name: its badge, and a mark when the provider says the model can call tools. */
export function ModelMarks({ model }: { model: ModelInfo }) {
    const { t } = useTranslation('agent-chat');

    return (
        <>
            {model.badge && (
                <Pill tone="accent" shape="tag" size="sm">
                    {model.badge.charAt(0).toLocaleUpperCase() + model.badge.slice(1)}
                </Pill>
            )}
            {model.tools === true && (
                <Tooltip label={t('pickers.model.tools')}>
                    <span className="flex shrink-0 text-text-faint" aria-label={t('pickers.model.tools')}>
                        <Icon icon={Wrench} size={12} />
                    </span>
                </Tooltip>
            )}
        </>
    );
}
