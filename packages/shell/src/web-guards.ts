/*
 * What the shell lets the app's page do, as pure decisions, so the main process only wires them to
 * Electron's events. The app's page carries the whole bridge, so each rule here is a security boundary.
 *
 * `schemes` lists the standard schemes an app registers for itself (`app://`): Node's URL gives every
 * scheme it does not know the origin `null`, where Chromium gives a registered standard scheme a real one.
 */

/* The origin of a URL, or null for one that does not parse or has no origin of its own (`about:`, `data:`). */
export const originOf = (url: string, schemes: readonly string[] = []): string | null => {
    try {
        const parsed = new URL(url);
        const scheme = parsed.protocol.slice(0, -1);

        if (schemes.includes(scheme)) {
            return parsed.host ? `${scheme}://${parsed.host.toLowerCase()}` : null;
        }

        return parsed.origin === 'null' ? null : parsed.origin;
    } catch {
        return null;
    }
};

export const isAppUrl = (url: string, appOrigin: string, schemes: readonly string[] = []): boolean => originOf(url, schemes) === appOrigin;

export const isWebLink = (url: string): boolean => /^https?:\/\//i.test(url);

/* What the system browser or mail app may be handed; a `file:` link could open an application. */
export const isExternalLink = (url: string): boolean => isWebLink(url) || /^mailto:/i.test(url);

export type NavigationVerdict = 'allow' | 'external' | 'refuse';

/*
 * Where the app window's own page may go. A dropped link or file navigates the top frame, and the page
 * it lands on would inherit the bridge, so only the app stays in the window and a web link leaves for
 * the system browser.
 */
export const appWindowNavigation = (url: string, appOrigin: string, schemes: readonly string[] = []): NavigationVerdict => {
    if (isAppUrl(url, appOrigin, schemes)) {
        return 'allow';
    }

    return isWebLink(url) ? 'external' : 'refuse';
};

/* What a person does on purpose: a press or a key, never a move, a wheel or a scroll. */
const DELIBERATE_INPUT: ReadonlySet<string> = new Set(['mouseDown', 'mouseUp', 'rawKeyDown', 'keyDown', 'gestureTap', 'touchEnd']);

/* How long after a press a link may still leave, which is longer than any click takes to navigate. */
const GESTURE_MS = 1000;

/*
 * Whether a link a page wants to open in the system browser follows a press of the person. A page that
 * runs scripts nobody vetted could otherwise send the person's browser anywhere, over and over. One
 * press lets one link out. `saw` takes the `type` of each `input-event` of the page.
 */
export const createGestureGate = (now: () => number = Date.now) => {
    let pressedAt: number | null = null;

    return {
        saw: (type: string): void => {
            if (DELIBERATE_INPUT.has(type)) {
                pressedAt = now();
            }
        },
        consume: (): boolean => {
            const recent = pressedAt !== null && now() - pressedAt <= GESTURE_MS;
            pressedAt = null;

            return recent;
        }
    };
};

export type GestureGate = ReturnType<typeof createGestureGate>;

/* The part of an IPC event's sender frame the check reads. */
export interface SenderFrame {
    readonly url: string;
    readonly parent: unknown;
}

/*
 * Whether an IPC message came from the app itself: the top frame of an app window, still on the app's
 * origin. The web contents alone says nothing, since it stays the same object whatever it navigates to.
 */
export const isAppSender = (isAppWindow: boolean, frame: SenderFrame | null, appOrigin: string, schemes: readonly string[] = []): boolean =>
    isAppWindow && frame !== null && frame.parent === null && isAppUrl(frame.url, appOrigin, schemes);
