import clsx from 'clsx';
import { X } from 'lucide-react';
import type { ComponentProps, KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { fieldControlProps, useFieldControl } from './field-context.ts';
import { IconButton } from './IconButton.tsx';

export interface TokenInputToken {
    key: string;
    label: string;

    /* Draws the token as one the caller could not accept, such as an address that does not parse. */
    invalid?: boolean;
}

export interface TokenInputProps extends Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'size'> {
    tokens: readonly TokenInputToken[];

    /* The text after the last token. */
    value: string;

    onValueChange(value: string): void;

    /* Enter, a comma, a semicolon or leaving the field, with text in it. The caller turns the text into tokens and clears it. */
    onCommit(value: string): void;

    /* A token's remove button, or Backspace in an empty field for the last token. */
    onRemove(key: string): void;

    /* The accessible name of the text field, where no `Field` gives it one. */
    label?: string;

    /* The accessible name of a token's remove button. Left out, it reads "Remove" and the label. */
    removeLabel?(token: TokenInputToken): string;

    /* Marks the text as one the caller cannot accept. */
    invalid?: boolean;

    /* `bare` drops the border, the ground and the focus outline, for a field inside a row or card that draws all three around it. */
    variant?: 'field' | 'bare';
}

const COMMIT_KEYS = new Set(['Enter', ',', ';']);

/* A row of removable tokens followed by free text, such as the recipients of a message or the tags of a note. The caller owns both. */
export function TokenInput({
    tokens,
    value,
    onValueChange,
    onCommit,
    onRemove,
    label,
    removeLabel,
    invalid = false,
    variant = 'field',
    className,
    id,
    onKeyDown,
    onBlur,
    ...props
}: TokenInputProps) {
    const { t } = useTranslation('ui');
    const field = useFieldControl();
    const control = fieldControlProps(field, id);

    const commit = (): void => {
        if (value.trim() !== '') {
            onCommit(value);
        }
    };

    const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        onKeyDown?.(event);

        // A key that confirms an IME composition is not one that ends the text.
        if (event.defaultPrevented || event.nativeEvent.isComposing) {
            return;
        }

        if (COMMIT_KEYS.has(event.key)) {
            event.preventDefault();
            commit();

            return;
        }

        const last = tokens.at(-1);

        if (event.key === 'Backspace' && value === '' && last !== undefined) {
            event.preventDefault();
            onRemove(last.key);
        }
    };

    // A click on the row beside the tokens lands in the text, as it would in a field of one line.
    const focusText = (event: MouseEvent<HTMLDivElement>): void => {
        if (event.target === event.currentTarget) {
            // Before the browser moves focus to the row, which would blur the text it is about to focus.
            event.preventDefault();
            event.currentTarget.querySelector('input')?.focus();
        }
    };

    return (
        <div
            className={clsx('field flex h-auto min-h-8 flex-wrap items-center gap-1 px-1 py-0.5', variant === 'bare' && 'field-bare', className)}
            onMouseDown={focusText}
        >
            {tokens.map((token) => (
                <span
                    key={token.key}
                    className={clsx(
                        'inline-flex h-6 max-w-full min-w-0 items-center gap-0.5 rounded-md pr-0.5 pl-2 text-xs',
                        token.invalid ? 'bg-status-error/14 text-status-error' : 'bg-text/8 text-text'
                    )}
                >
                    <span className="truncate">{token.label}</span>
                    <IconButton
                        icon={X}
                        size="2xs"
                        label={removeLabel?.(token) ?? t('tokenInput.remove', { label: token.label })}
                        tooltip={false}
                        onClick={() => onRemove(token.key)}
                    />
                </span>
            ))}
            <input
                {...control}
                aria-label={label}
                aria-invalid={invalid || control['aria-invalid']}
                {...props}
                value={value}
                className="h-6 min-w-16 flex-1 bg-transparent px-1.5 outline-none placeholder:text-text-faint aria-invalid:text-status-error"
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={keyDown}
                onBlur={(event) => {
                    onBlur?.(event);
                    commit();
                }}
            />
        </div>
    );
}
