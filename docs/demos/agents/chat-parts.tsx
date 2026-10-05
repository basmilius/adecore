import type { ReactNode } from 'react';
import { NOW, PICTURE, chatInfo, chatItems } from '../shared/agents-data.ts';
import { AgentDemo } from '../shared/agents.tsx';
import { DEMO_CHAT } from '../shared/agents-host.ts';
import { ChatActivity, StatusIcon } from '@adecore/agents-react/chat/ui/ChatActivity';
import { AccountPill } from '@adecore/agents-react/chat/ui/AccountPill';
import { ChatReferenceChip } from '@adecore/agents-react/chat/ui/ChatReferenceChip';
import { ImageThumb } from '@adecore/agents-react/chat/ui/ImageView';
import { UploadThumb } from '@adecore/agents-react/chat/ui/UploadThumb';
import { WelcomeGreeting } from '@adecore/agents-react/chat/ui/Welcome';
import type { StatusWord } from '@adecore/agents-react/agents/status-look';

const WORDS: StatusWord[] = ['running', 'paused', 'done', 'failed', 'cancelled'];

/* The demo chat with a helper agent behind it and a test watcher running in the background, under a second account. */
const busyChat = () => ({
    [DEMO_CHAT]: {
        info: chatInfo(DEMO_CHAT, {
            account: 'claude-work',
            background: [{ id: 'shell-1', kind: 'shell' as const, description: 'Watch the tests', command: 'bun test --watch', startedAt: NOW - 120_000 }]
        }),
        items: chatItems()
    }
});

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-4">
            <span className="w-36 shrink-0 text-xs text-text-muted">{label}</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

export default function ChatPartsDemo() {
    return (
        <AgentDemo chats={busyChat}>
            <div className="flex w-full flex-col gap-4">
                <WelcomeGreeting chatId={DEMO_CHAT} />
                <Row label="ChatActivity">
                    <ChatActivity chatId={DEMO_CHAT} />
                </Row>
                <Row label="StatusIcon">
                    {WORDS.map((word) => (
                        <span key={word} className="flex items-center gap-1 text-xs">
                            <StatusIcon word={word} /> {word}
                        </span>
                    ))}
                </Row>
                <Row label="AccountPill">
                    <AccountPill chatId={DEMO_CHAT} />
                </Row>
                <Row label="ChatReferenceChip">
                    <ChatReferenceChip chatId="chat-release" />
                    <ChatReferenceChip chatId="chat-gone" onRemove={() => undefined} />
                </Row>
                <Row label="UploadThumb, ImageThumb">
                    <UploadThumb upload={PICTURE} />
                    <ImageThumb
                        source={{ url: `data:${PICTURE.mime};base64,${PICTURE.data}`, failure: null }}
                        alt={PICTURE.name}
                        className="size-16 object-cover"
                    />
                    <ImageThumb source={{ url: null, failure: 'The host keeps no file under this id.' }} alt="Missing" />
                </Row>
            </div>
        </AgentDemo>
    );
}
