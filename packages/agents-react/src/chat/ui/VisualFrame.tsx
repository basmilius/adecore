import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { visualThemeFragment, type ChatVisual, type VisualAppearance, type VisualTheme } from '@adecore/agent-contracts/visual';
import { Spinner, useMeasuredWidth } from '@adecore/ui';
import { chatHost } from '../../host';
import { useChatScope } from '../../scope';
import { initialVisualHeight, rememberVisualHeight } from '../logic/visual-height';
import { VisualBridge } from '../visual-bridge';
import { useVisualTheme } from './visual-theme';

export interface VisualFrameProps {
    chatId: string;
    visual: ChatVisual;
    /* Fills its positioned parent and lets the page scroll inside it, rather than taking the height the page reports. */
    fill?: boolean;
    className?: string;
}

/*
 * A link the page asks to open counts only while a person acts in the frame: it has the focus, and a
 * click or a key in it is recent. A page can take the focus by script, so this stops a link opened as
 * the page loads, and not one opened while a person works in the frame.
 */
function personActsIn(frame: HTMLIFrameElement): boolean {
    return frame.ownerDocument.activeElement === frame && navigator.userActivation?.isActive !== false;
}

/*
 * One visual's page in a frame on the thread's own ground. The frame loads the app's sandbox host
 * page on an origin of its own, never with that origin's rights over the app, and the bridge hands
 * it the page and the theme. Its box keeps one height while the page loads and when it fails, so
 * nothing under it moves.
 */
export function VisualFrame({ chatId, visual, fill = false, className }: VisualFrameProps) {
    const { t } = useTranslation('agent-chat');
    const scope = useChatScope();
    const frameUrl = chatHost().visuals?.frameUrl ?? null;
    const boxRef = useRef<HTMLDivElement | null>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const bridgeRef = useRef<VisualBridge | null>(null);
    const [measure, width] = useMeasuredWidth();
    const setBox = useCallback(
        (node: HTMLDivElement | null) => {
            boxRef.current = node;
            measure(node);
        },
        [measure]
    );
    const theme = useVisualTheme(boxRef);
    const widthRef = useRef(width);
    const [reported, setReported] = useState<number | null>(null);
    // The appearance the page is drawn in once it runs; until then the frame matches the sandbox host page, which declares none.
    const [drawn, setDrawn] = useState<VisualAppearance | null>(null);
    const [failed, setFailed] = useState(false);
    // The frame keeps the address it opened with: a later theme goes over the bridge, since a new address would load the page again.
    const [opening, setOpening] = useState<{ src: string; theme: VisualTheme } | null>(null);
    if (opening === null && frameUrl !== null && theme !== null && width > 0) {
        setOpening({ src: frameUrl + visualThemeFragment(theme), theme });
    }
    const height = fill || width === 0 ? undefined : (reported ?? initialVisualHeight(visual, width));

    useLayoutEffect(() => {
        widthRef.current = width;
    }, [width]);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        if (opening === null || frame === null) {
            return;
        }
        const bridge = new VisualBridge({
            frame: () => frame.contentWindow,
            visual: { maxHeight: visual.maxHeight },
            page: chatHost()
                .attachments.read(scope.id, chatId, visual.id)
                .then((blob) => blob.text()),
            theme: opening.theme,
            mayOpenLink: () => personActsIn(frame),
            openLink: (url) => chatHost().visuals?.openLink(url),
            onHeight: (next) => {
                if (fill) {
                    return;
                }
                setReported(next);
                rememberVisualHeight(visual.id, widthRef.current, next);
            },
            onAppearance: setDrawn,
            onFailure: () => setFailed(true)
        });
        bridgeRef.current = bridge;
        const view = frame.ownerDocument.defaultView ?? window;
        const listen = (event: MessageEvent): void => bridge.receive(event);
        view.addEventListener('message', listen);
        return () => {
            view.removeEventListener('message', listen);
            bridge.dispose();
            bridgeRef.current = null;
        };
    }, [opening, scope.id, chatId, visual.id, visual.maxHeight, fill]);

    useEffect(() => {
        if (theme !== null) {
            bridgeRef.current?.setTheme(theme);
        }
    }, [theme]);

    return (
        <div ref={setBox} className={clsx(fill ? 'absolute inset-0' : 'relative w-full', className)} style={{ height }}>
            {opening !== null && (
                <iframe
                    ref={frameRef}
                    src={opening.src}
                    title={visual.title}
                    loading="lazy"
                    sandbox="allow-scripts allow-forms"
                    className={clsx('block size-full border-0', failed && 'invisible')}
                    // A frame whose color scheme differs from its document's paints an opaque ground behind it.
                    style={{ colorScheme: drawn ?? 'normal' }}
                    onLoad={() => bridgeRef.current?.loaded()}
                />
            )}
            {failed ? (
                <p className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-text-muted">
                    {t('visuals.failed', { title: visual.title })}
                </p>
            ) : (
                drawn === null && (
                    <span className="chat-visual-wait pointer-events-none absolute inset-0 grid place-items-center text-text-faint">
                        <Spinner size={16} label={t('visuals.loading', { title: visual.title })} />
                    </span>
                )
            )}
        </div>
    );
}
