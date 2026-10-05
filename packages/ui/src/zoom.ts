/* The percentages a zoom menu offers when the app names none. */
export const ZOOM_PRESETS: readonly number[] = [25, 50, 75, 100, 150, 200];

/* Compared on the rounded percent the readout shows, so 0.999 still ticks 100%. */
export const activeZoomPreset = (zoom: number, presets: readonly number[]): number | null =>
    presets.find((preset) => preset === Math.round(zoom * 100)) ?? null;

/* Ten percent a click, on the readout's own rounded percent, so + and - come back where they were. */
export const steppedZoom = (zoom: number, by: number): number => Math.round(zoom * 100 + by) / 100;
