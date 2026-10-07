import { useEffect, useRef, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { Input } from '@adecore/ui';
import { CODE_TEXT } from '../code-text.ts';

export type EditMove = 'next' | 'previous';

export interface CellEditorProps {
    value: string;
    label: string;
    onValueChange(value: string): void;
    /* Enter commits in place; Tab commits and moves on. */
    onCommit(move?: EditMove): void;
    onCancel(): void;
}

/* The input a cell turns into while it is edited. It takes the focus and selects its text when it appears. */
export function CellEditor({ value, label, onValueChange, onCommit, onCancel }: CellEditorProps) {
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        input.current?.focus();
        input.current?.select();
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.nativeEvent.isComposing) {
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            onCommit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            onCommit(event.shiftKey ? 'previous' : 'next');
        }
    };

    return (
        <Input
            ref={input}
            size="sm"
            aria-label={label}
            value={value}
            className={clsx(CODE_TEXT, 'absolute inset-0 z-10 h-full min-w-0 rounded-none px-3')}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => onCommit()}
        />
    );
}
