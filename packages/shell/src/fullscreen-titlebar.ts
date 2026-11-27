import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * The native module that shows a fullscreen macOS window's traffic lights the way a native app with a toolbar
 * does: they fade in over the page, at their place outside fullscreen, as the menu bar comes down.
 */
export interface FullScreenTitlebar {
    /*
     * Follows the window from now on. `handle` is its `getNativeWindowHandle()`. In fullscreen `report` hears
     * whether the lights show and how far the menu bar pushes the top of the window down, which stays 0 on a
     * display with a notch. Answers whether the window could be followed.
     */
    attach(handle: Buffer, report: (revealed: boolean, offset: number) => void): boolean;
}

export interface FullScreenTitlebarBuild {
    /* Where the `.node` file goes; its folder is made when missing. */
    outfile: string;
    /* The CPU the app ships for. The machine's own by default. */
    arch?: 'arm64' | 'x64';
}

/*
 * Compiles the native module with the Xcode command line tools, from the Objective-C source shipped in the
 * package's `native` folder. macOS only, for macOS 14 and later; throws with clang's output when it fails.
 */
export function buildFullScreenTitlebar(build: FullScreenTitlebarBuild): void {
    // Resolved here rather than at the top, so a bundled main process never carries the path of the build machine.
    const source = fileURLToPath(new URL('../native/fullscreen-titlebar.m', import.meta.url));
    const arch = (build.arch ?? process.arch) === 'x64' ? 'x86_64' : 'arm64';
    mkdirSync(dirname(build.outfile), { recursive: true });

    // Electron's main process provides the Node-API symbols, so they stay undefined until the module loads.
    const result = spawnSync(
        'clang',
        [
            '-dynamiclib',
            '-undefined',
            'dynamic_lookup',
            '-fobjc-arc',
            '-O2',
            '-arch',
            arch,
            '-mmacosx-version-min=14.0',
            '-framework',
            'AppKit',
            '-framework',
            'QuartzCore',
            source,
            '-o',
            build.outfile
        ],
        { encoding: 'utf8' }
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`clang failed to build the fullscreen title bar module:\n${result.stderr}`);
    }
}

/*
 * Loads the module `buildFullScreenTitlebar` wrote, in the main process. `null` off macOS and when the file is
 * missing, such as a dev run that skipped the build; a fullscreen window then keeps macOS's own title bar strip.
 * Throws when the file is there but does not load, since that is a broken build.
 */
export function loadFullScreenTitlebar(path: string, platform: NodeJS.Platform = process.platform): FullScreenTitlebar | null {
    if (platform !== 'darwin' || !existsSync(path)) {
        return null;
    }

    const module = { exports: {} as Partial<FullScreenTitlebar> };
    process.dlopen(module, path);
    const { attach } = module.exports;

    if (typeof attach !== 'function') {
        throw new Error(`${path} is not the fullscreen title bar module.`);
    }

    return { attach };
}
