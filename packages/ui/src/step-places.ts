/* The places after the separator that `step` is written with, so a step of 0.1 shows `1,0` and never `1`. */
export const placesOf = (step: number): number => String(step).split('.')[1]?.length ?? 0;
