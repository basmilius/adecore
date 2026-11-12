/* The room a page keeps free at the start of its first column for the window's own controls, such as the traffic lights. */
export interface WindowControlsState {
    /* In CSS pixels; `null` where the window draws no controls there, or hides them, as in fullscreen. */
    inset: number | null;
}

export interface WindowControlsOptions {
    fullscreen?: boolean;

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
    return { inset: platform === 'darwin' && !options.fullscreen ? lights.x * 2 + TRAFFIC_LIGHTS_WIDTH : null };
};
