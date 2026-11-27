/* The room a page keeps free at the start of its first column for the window's own controls, such as the traffic lights. */
export interface WindowControlsState {
    /* In CSS pixels; `null` where the window draws no controls there, or hides them, as in fullscreen. */
    inset: number | null;

    /*
     * In fullscreen on macOS with `fullScreenTitlebar` of `createTheme`: how far, in CSS pixels, the menu bar
     * pushes the top of the window down while it shows. The top bar of a page comes down with it, as a native
     * toolbar does. It stays 0 on a display with a notch, where the menu bar has a place of its own.
     */
    offset?: number;
}

export interface WindowControlsOptions {
    fullscreen?: boolean;

    /* In fullscreen, whether the traffic lights show over the page, as they do with `fullScreenTitlebar` while the menu bar is down. */
    revealed?: boolean;

    /* Where macOS puts the traffic lights, as `trafficLights` of `createTheme` sets them. */
    trafficLights?: { x: number; y: number };
}

export const TRAFFIC_LIGHTS = { x: 17, y: 17 };

/* Three lights of 12 pixels with 8 between them. */
const TRAFFIC_LIGHTS_WIDTH = 52;

/*
 * The room for the controls on a platform. A page reads it from its own platform before the shell answers,
 * so its first frame already clears the traffic lights instead of moving once the answer comes in.
 */
export const windowControlsOf = (platform: string, options: WindowControlsOptions = {}): WindowControlsState => {
    const lights = options.trafficLights ?? TRAFFIC_LIGHTS;

    // As far past the lights as they sit from the edge, so they read as a group of their own. macOS hides them in fullscreen.
    const shown = !options.fullscreen || options.revealed === true;

    return { inset: platform === 'darwin' && shown ? lights.x * 2 + TRAFFIC_LIGHTS_WIDTH : null };
};
