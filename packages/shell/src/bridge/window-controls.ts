/* The room a page keeps free at the start of its first column for the window's own controls, such as the traffic lights. */
export interface WindowControlsState {
    /* In CSS pixels; `null` where the window draws no controls there, or hides them, as in fullscreen. */
    inset: number | null;
}
