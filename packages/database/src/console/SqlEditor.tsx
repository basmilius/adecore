import type { KeyboardEvent, Ref } from 'react';
import { isApplePlatform, isModHeld, TextArea } from '@adecore/ui';

export interface SqlEditorProps {
    value: string;
    onValueChange(value: string): void;
    /* Mod+Enter. */
    onRun(): void;
    label: string;
    placeholder?: string;
    className?: string;
    ref?: Ref<HTMLTextAreaElement>;
}

/*
 * Where the SQL is typed. A plain text area for now, kept to itself so an editor with highlighting
 * and completion can take its place without the console noticing: it needs only these props.
 */
export function SqlEditor({ value, onValueChange, onRun, label, placeholder, className, ref }: SqlEditorProps) {
    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (event.key === 'Enter' && isModHeld(event, isApplePlatform())) {
            event.preventDefault();
            onRun();
        }
    };

    return (
        <TextArea
            ref={ref}
            mono
            resize="vertical"
            aria-label={label}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={8}
            value={value}
            className={className}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
        />
    );
}
