import { useContext } from 'react';
import clsx from 'clsx';
import type { AgentKind } from '@adecore/agent-contracts';
import { ChatScopeContext } from '../scope';
import { useProvidersStore } from '../state/providers';
import { AgentIcon } from './AgentIcon';
import { modelName } from './model-name';
import { hasProviderLogo } from './provider-paths';
import { ProviderLogo } from './ProviderLogo';

interface AgentModelLabelProps {
    provider: AgentKind;
    /* The model's slug; absent names the CLI itself. */
    model?: string;
    /* The machine whose catalog names the model; absent, the chat scope the label is drawn in. */
    scopeId?: string;
    size?: number;
    className?: string;
}

/*
 * Who answered or will answer, in one line: the CLI's mark and the model, named the way the machine's
 * catalog names it, as a row of facts writes it ("made by", "runs as").
 */
export function AgentModelLabel({ provider, model, scopeId, size = 14, className }: AgentModelLabelProps) {
    // Outside a chat scope a host names the machine itself; with neither, the CLI still draws, by its kind.
    const scope = useContext(ChatScopeContext);
    const id = scopeId ?? scope?.id;
    const catalog = useProvidersStore((s) => (id === undefined ? undefined : s.byScope[id]?.providers.find((entry) => entry.kind === provider)));
    const name = model === undefined ? (catalog?.name ?? provider) : modelName(model, catalog?.models);
    return (
        <span className={clsx('flex min-w-0 items-center gap-1.5', className)}>
            {hasProviderLogo(provider) ? <ProviderLogo provider={provider} size={size} /> : <AgentIcon kind={provider} size={size} className="shrink-0" />}
            <span className="truncate">{name}</span>
        </span>
    );
}
