import clsx from 'clsx';

/* A Base UI `className`: a string, or a function of the part's state. */
export type StateClassName<State> = string | ((state: State) => string | undefined) | undefined;

/* Puts the library's own classes before a caller's, whichever form the caller's takes. */
export const withClass = <State>(own: string, className: StateClassName<State>): string | ((state: State) => string) =>
    typeof className === 'function' ? (state: State) => clsx(own, className(state)) : clsx(own, className);
