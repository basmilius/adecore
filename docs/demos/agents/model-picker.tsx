import { useState } from 'react';
import type { AgentKind, ModelSelection } from '@adecore/agent-contracts';
import { ModelOptionControl } from '@adecore/agents-react/agents/ModelOptionControl';
import { carryOptions } from '@adecore/agents-react/agents/model-options';
import { ModelPicker } from '@adecore/agents-react/chat/ui/Pickers';
import { PROVIDERS } from '../shared/agents-data.ts';
import '../shared/agents-host.ts';

export default function ModelPickerDemo() {
    const [provider, setProvider] = useState<AgentKind>('claude');
    const [selection, setSelection] = useState<ModelSelection>({ model: 'sonnet', options: {} });
    const [open, setOpen] = useState(false);
    const model = PROVIDERS.find((entry) => entry.kind === provider)?.models.find((entry) => entry.slug === selection.model);

    return (
        <div className="flex w-full max-w-sm flex-col gap-3">
            <ModelPicker
                providers={PROVIDERS}
                provider={provider}
                selection={selection}
                open={open}
                onOpenChange={setOpen}
                onChange={(next, slug) => {
                    const target = PROVIDERS.find((entry) => entry.kind === next)?.models.find((entry) => entry.slug === slug);
                    setProvider(next);
                    setSelection({ model: slug, options: carryOptions(selection.options, target) });
                }}
                kbd={null}
                side="bottom"
                trigger="chip"
            />
            {model?.options.map((option) => (
                <ModelOptionControl
                    key={option.id}
                    option={option}
                    options={selection.options}
                    layout="row"
                    onChange={(value) => setSelection({ ...selection, options: { ...selection.options, [option.id]: value } })}
                />
            ))}
        </div>
    );
}
