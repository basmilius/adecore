import { EmptyScene } from '@adecore/ui';
import { AgentIcon } from '../../agents/AgentIcon';

/* A question goes out and the model answers. Its mark is the one accent here, so the typing dots stay neutral. */
export function ChatEmptyScene({ provider }: { provider: string }) {
    return (
        <EmptyScene>
            <g className="scene-loop">
                <g className="chat-scene-send">
                    <g className="scene-lift">
                        <rect className="scene-shape" x="70" y="10" width="78" height="24" rx="12" />
                    </g>
                    <path className="scene-text" d="M82 22h52" />
                </g>
                <g className="scene-reveal-2">
                    <svg x="11" y="43" width="20" height="20" overflow="visible">
                        <AgentIcon kind={provider} size={20} />
                    </svg>
                </g>
                <g className="chat-scene-typing">
                    <circle className="scene-dot chat-scene-bounce" cx="42" cy="53" r="2.5" />
                    <circle className="scene-dot chat-scene-bounce" cx="52" cy="53" r="2.5" />
                    <circle className="scene-dot chat-scene-bounce" cx="62" cy="53" r="2.5" />
                </g>
                <path className="scene-text scene-type-5" pathLength={1} d="M40 53h98" />
                <path className="scene-text scene-type-7" pathLength={1} d="M40 66h84" />
                <path className="scene-text scene-type-9" pathLength={1} d="M40 79h56" />
            </g>
        </EmptyScene>
    );
}
