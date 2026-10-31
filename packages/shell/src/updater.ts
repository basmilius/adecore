import type { AppUpdater, UpdateCheckResult } from 'electron-updater';
import type { UpdateErrorCode, UpdateState } from './bridge/update.ts';

/* Often enough that a release lands the same day, rarely enough to be invisible. */
export const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/*
 * electron-updater puts the whole HTTP exchange in the message of a failed check: every response
 * header, the session cookie among them. Only the first line travels. The words are the page's, in
 * the person's language, so the shell sends a code beside that line and no sentence of its own.
 */
export const describeUpdateError = (message: string): { code: UpdateErrorCode; detail: string | null } => {
    const first = message.split('\n')[0]?.trim();

    if (!first) {
        return { code: 'failed', detail: null };
    }

    return {
        code: first.startsWith('404') ? 'no-feed' : 'failed',
        detail: first.length > 200 ? `${first.slice(0, 200)}…` : first
    };
};

export interface UpdaterOptions {
    currentVersion: string;
    /* False in a checkout: electron-updater reads `app-update.yml` from the bundle, so a checkout has no feed. */
    packaged: boolean;
    /* `require('electron-updater').autoUpdater`, loaded only in a packaged app. */
    load: () => AppUpdater;
    /* Every change of the state, for the pages that draw it. */
    publish: (state: UpdateState) => void;
    /* Right before a check asks the feed, such as to refresh release notes along with it. */
    beforeCheck?: () => void;
    /*
     * True right before installing quits the app, false when that install failed and the app stays.
     * electron-updater closes the windows before the app's own `before-quit`, so this is where a set of
     * windows learns the quit is coming: pass `windows.quitForUpdate`.
     */
    onQuit?: (quitting: boolean) => void;
    /* Installs without the installer's windows and starts the app again after. Only Windows reads it. */
    silentInstall?: boolean;
    log?: (message: string, error: unknown) => void;
    setInterval?: (run: () => void, ms: number) => unknown;
}

/*
 * The updater as a state machine the page watches, not a dialog that interrupts. In a checkout the
 * state stays `unsupported`, so nothing in the page offers to update.
 */
export const createUpdater = (options: UpdaterOptions) => {
    const log = options.log ?? ((message, error) => console.error(message, error));
    const every = options.setInterval ?? ((run, ms) => setInterval(run, ms));
    let state: UpdateState = { status: 'unsupported', currentVersion: options.currentVersion };
    let updater: AppUpdater | null = null;
    let timer: unknown = null;
    let installing = false;
    let allowPrerelease: boolean | null = null;
    // What stops the download a check offered, also one it started by itself.
    let download: UpdateCheckResult['cancellationToken'] | null = null;
    let checkAgain = false;

    const setState = (patch: Partial<UpdateState>): void => {
        state = { ...state, ...patch };
        options.publish(state);
    };

    const installFailed = (): void => {
        if (installing) {
            installing = false;
            options.onQuit?.(false);
        }
    };

    const refused = (version: string | undefined): boolean => allowPrerelease === false && version?.includes('-') === true;

    /* A prerelease the person no longer follows: nothing may finish it or install it, also not a quit, which installs what is downloaded. */
    const discard = (): void => {
        download?.cancel();
        download = null;

        if (updater) {
            updater.autoInstallOnAppQuit = false;
        }

        setState({ status: 'idle', version: undefined, percent: undefined, error: null, errorCode: null });
    };

    const check = async (): Promise<void> => {
        // Nothing to learn while a check or a download runs, or while a build waits to be installed.
        if (!updater || state.status === 'checking' || state.status === 'downloading' || state.status === 'ready') {
            return;
        }

        options.beforeCheck?.();

        try {
            const result = await updater.checkForUpdates();
            download = result?.cancellationToken ?? null;

            // The track changed under this check, and with autoDownload its download already runs.
            if (refused(result?.updateInfo.version)) {
                download?.cancel();
                download = null;
            }
        } catch (e) {
            // checkForUpdates rejects as well as emitting `error`; the state is already set there.
            log('Update check failed', e);
        }

        if (checkAgain) {
            checkAgain = false;
            await check();
        }
    };

    return {
        state: (): UpdateState => state,

        start: (): void => {
            if (!options.packaged) {
                return;
            }

            try {
                const loaded = options.load();
                // The page sends its preference before the first check, so nothing downloads for someone who turned it off.
                loaded.autoDownload = false;

                if (allowPrerelease !== null) {
                    loaded.allowPrerelease = allowPrerelease;
                }

                loaded.on('checking-for-update', () => setState({ status: 'checking', error: null, errorCode: null }));

                loaded.on('update-available', (info) => {
                    if (refused(info.version)) {
                        discard();

                        return;
                    }

                    setState({ status: 'available', version: info.version, error: null, errorCode: null });
                });

                loaded.on('update-not-available', () => setState({ status: 'current', version: undefined, error: null, errorCode: null }));

                loaded.on('download-progress', (progress) => {
                    // What is left of a download `discard` stopped, which has no version to tell it by.
                    if (state.version !== undefined) {
                        setState({ status: 'downloading', percent: progress.percent });
                    }
                });

                loaded.on('update-downloaded', (info) => {
                    if (refused(info.version)) {
                        discard();

                        return;
                    }

                    loaded.autoInstallOnAppQuit = true;
                    download = null;
                    setState({ status: 'ready', version: info.version, percent: 100 });
                });

                loaded.on('error', (e) => {
                    installFailed();
                    const { code, detail } = describeUpdateError(e.message);
                    setState({ status: 'error', error: detail, errorCode: code });
                });

                updater = loaded;
                setState({ status: 'idle' });
            } catch (e) {
                // electron-updater missing from the bundle is the only way here; the app stays as it is.
                log('The updater did not start', e);
            }
        },

        /* The hourly check starts with the first preference the page sends, never before: until then the shell does not know whether it may download what a check turns up. */
        configure: (autoDownload: unknown): void => {
            if (!updater) {
                return;
            }

            updater.autoDownload = autoDownload === true;
            timer ??= every(() => void check(), UPDATE_INTERVAL_MS);
        },

        check,

        /*
         * Which releases the updater offers. Without this call it follows the running version. Leaving
         * prereleases also drops one that is offered, downloading or waiting to install; a check that runs
         * under the old answer is asked again once it ends.
         */
        setAllowPrerelease: (allow: boolean): void => {
            allowPrerelease = allow;

            if (!updater) {
                return;
            }

            updater.allowPrerelease = allow;

            if (refused(state.version)) {
                discard();
            } else if (state.status === 'checking') {
                checkAgain = true;
            }
        },

        download: async (): Promise<void> => {
            if (!updater) {
                return;
            }

            try {
                await updater.downloadUpdate(download ?? undefined);
            } catch (e) {
                log('Update download failed', e);
            }
        },

        /* Quits into the downloaded build. False when there is none, or the install failed at once. */
        install: (): boolean => {
            if (!updater || state.status !== 'ready') {
                return false;
            }

            installing = true;
            options.onQuit?.(true);

            try {
                if (options.silentInstall) {
                    updater.quitAndInstall(true, true);
                } else {
                    updater.quitAndInstall();
                }

                return true;
            } catch (e) {
                log('Update install failed', e);
                installFailed();

                return false;
            }
        }
    };
};

export type Updater = ReturnType<typeof createUpdater>;
