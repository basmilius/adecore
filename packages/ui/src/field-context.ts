import { createContext, useContext } from 'react';

export interface FieldControl {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
}

export const FieldContext = createContext<FieldControl | null>(null);

/* What an `Input` or a `TextArea` inside a `Field` takes over: the id its label points at, the hint and the error it is described by. */
export const useFieldControl = (): FieldControl | null => useContext(FieldContext);

/* The attributes that connect a control to its field; an `id` the caller sets wins over the field's. */
export const fieldControlProps = (field: FieldControl | null, id: string | undefined) => ({
    id: id ?? field?.id,
    'aria-describedby': field?.describedBy,
    'aria-invalid': field?.invalid || undefined
});
