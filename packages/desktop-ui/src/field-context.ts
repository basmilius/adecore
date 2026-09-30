import { createContext, useContext } from 'react';

export interface FieldControl {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
}

export const FieldContext = createContext<FieldControl | null>(null);

/* What an `Input` or a `TextArea` inside a `Field` takes over: the id its label points at, the hint and the error it is described by. */
export const useFieldControl = (): FieldControl | null => useContext(FieldContext);
