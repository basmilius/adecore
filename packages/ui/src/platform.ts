/* What an app answers when it knows the platform better than the page does; undefined leaves the answer to the page. */
export type ApplePlatformSource = () => boolean | undefined;

let source: ApplePlatformSource | null = null;

/* Answers the source it replaced, so a test can put that one back. */
export const setApplePlatform = (next: ApplePlatformSource | null): ApplePlatformSource | null => {
    const previous = source;
    source = next;

    return previous;
};

/* True on macOS and iOS, where a shortcut is written with ⌘ instead of Ctrl. The keyboard in question is the one in front of this page, unless the app said otherwise. */
export const isApplePlatform = (): boolean => {
    const handed = source?.();

    if (handed !== undefined) {
        return handed;
    }

    if (typeof navigator === 'undefined') {
        return false;
    }

    const hints = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;

    return applePlatformFrom(hints?.platform || navigator.platform);
};

export const applePlatformFrom = (platform: string | undefined): boolean => /mac|iphone|ipad/i.test(platform ?? '');
