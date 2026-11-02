import { useEffect } from 'react';
import { useChatScope } from '@adecore/agents-react';
import { AgentIcon } from '@adecore/agents-react/providers';
import { Composer, Timeline } from '@adecore/agents-react/chat/ui';
import { useChatRow } from '@adecore/agents-react/state';
import { Sparkline } from '@adecore/charts';
import { formatNumber } from '@adecore/ui/format';
import { AgentDemo } from '../shared/agents.tsx';
import { DEMO_CHAT } from '../shared/agents-host.ts';
import { eventsPerService } from '../shared/chart-data.ts';
import { DEMO_OPTIONS, useEditor } from '../shared/editor.ts';

const services = eventsPerService().slice(0, 3);

function Chat() {
    const scope = useChatScope();
    const info = useChatRow(DEMO_CHAT, (row) => row?.info);

    useEffect(() => {
        void scope.chats.open(DEMO_CHAT, {});

        return () => void scope.chats.detach(DEMO_CHAT);
    }, [scope]);

    return (
        <section className="flex min-w-0 flex-col border-border min-[960px]:border-r">
            <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
                <AgentIcon kind={info?.provider ?? 'claude'} />
                <span className="truncate text-sm font-medium">Retry for fetchJson</span>
            </header>
            <Timeline
                chatId={DEMO_CHAT}
                composer={
                    info && (
                        <Composer
                            chatId={DEMO_CHAT}
                            info={info}
                            focused={false}
                            disabled={false}
                            providerFixed={false}
                            onSend={(text, extras) => void scope.chats.send(DEMO_CHAT, text, extras)}
                            onRetarget={(provider, selection) => scope.chats.retarget(DEMO_CHAT, provider, selection)}
                        />
                    )
                }
            />
        </section>
    );
}

function Code() {
    const { host } = useEditor(DEMO_OPTIONS);

    return (
        <section className="flex min-h-0 flex-1 flex-col">
            <header className="flex h-10 shrink-0 items-center border-b border-border px-3 font-mono text-sm text-text-muted">src/order.ts</header>
            <div className="relative min-h-0 flex-1">
                <div ref={host} className="absolute inset-0" />
            </div>
        </section>
    );
}

function Activity() {
    return (
        <ul className="flex shrink-0 flex-col divide-y divide-border-soft border-t border-border px-3">
            {services.map((service) => (
                <li key={service.name} className="flex h-9 items-center gap-3 text-sm">
                    <span className="w-24 font-mono text-text">{service.name}</span>
                    <Sparkline values={service.perDay} kind="bars" label={`Events of ${service.name} in 14 days`} width={96} height={16} />
                    <span className="ml-auto text-text-muted tabular-nums">{formatNumber(service.perDay.reduce((sum, count) => sum + count, 0))}</span>
                </li>
            ))}
        </ul>
    );
}

/* A window of an app built from the packages: an agent chat beside the file it works on and the activity of its services. */
export default function ShowcaseDemo() {
    return (
        <AgentDemo>
            <div className="grid h-[560px] w-full grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-surface text-left min-[960px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <Chat />
                <div className="hidden min-w-0 flex-col min-[960px]:flex">
                    <Code />
                    <Activity />
                </div>
            </div>
        </AgentDemo>
    );
}
