import clsx from 'clsx';
import { useEffect, useRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Keys } from './Kbd.tsx';
import { isApplePlatform } from './platform.ts';
import { formatShortcut, shortcutFromEvent, type Shortcut } from './shortcut.ts';

/* The words, when the app wants its own; each falls back to the library's. */
export interface ShortcutInputLabels {
    /* While it waits for a key. */
    prompt?: string;

    /* For a key `shortcut()` cannot write. */
    unsupported?: string;
}

export interface ShortcutInputProps {
    /* The shortcut it shows while it is not recording. */
    value: Shortcut;

    /* The recorded shortcut, once `validate` accepts it. Recording ends with it. */
    onChange(next: Shortcut): void;

    /* The accessible name, such as "Shortcut for Open palette"; the current shortcut is read out after it. */
    label: string;

    /* A reason to refuse a shortcut, such as "Needs Cmd, Ctrl or Alt". It shows in place of the prompt and recording goes on. */
    validate?(next: Shortcut): string | null;

    /* Whether it is waiting for a key, so the app can hold back what else would take one, such as a native menu accelerator. */
    onRecordingChange?(recording: boolean): void;

    labels?: ShortcutInputLabels;
    size?: 'md' | 'sm';
    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

const MODIFIER_KEYS = new Set(['Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'Meta', 'Shift']);

/**
 * A shortcut as keys that turns into a recorder when pressed. While it records, no other listener sees a
 * key, so a shortcut the person presses does not run. Escape ends recording, so does leaving the button,
 * and a bare Backspace is ignored. The first key combination `validate` accepts replaces the value.
 */
export function ShortcutInput({ value, onChange, label, validate, onRecordingChange, labels = {}, size = 'md', disabled, className, ref }: ShortcutInputProps) {
    const { t } = useTranslation('ui');
    const [recording, setRecording] = useState(false);
    const [refusal, setRefusal] = useState<string | null>(null);
    const notify = useRef(onRecordingChange);
    const apple = isApplePlatform();
    const unsupported = labels.unsupported ?? t('shortcutInput.unsupported');

    useEffect(() => {
        notify.current = onRecordingChange;
    });

    useEffect(() => {
        if (!recording) {
            return;
        }

        notify.current?.(true);

        return () => notify.current?.(false);
    }, [recording]);

    useEffect(() => {
        if (!recording) {
            return;
        }

        const stop = (): void => {
            setRecording(false);
            setRefusal(null);
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            event.preventDefault();
            event.stopImmediatePropagation();

            if (event.repeat || event.isComposing || MODIFIER_KEYS.has(event.key)) {
                return;
            }

            const bare = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;

            if (bare && event.key === 'Escape') {
                stop();

                return;
            }

            if (bare && event.key === 'Backspace') {
                return;
            }

            const next = shortcutFromEvent(event, apple);

            if (next === null) {
                setRefusal(unsupported);

                return;
            }

            const reason = validate?.(next) ?? null;

            if (reason !== null) {
                setRefusal(reason);

                return;
            }

            stop();
            onChange(next);
        };
        const onKeyUp = (event: KeyboardEvent): void => event.stopImmediatePropagation();

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);

        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
        };
    }, [recording, apple, unsupported, validate, onChange]);

    return (
        <button
            ref={ref}
            type="button"
            disabled={disabled}
            aria-label={recording ? label : `${label}: ${formatShortcut(value, apple)}`}
            onClick={() => {
                setRefusal(null);
                setRecording((current) => !current);
            }}
            onBlur={() => {
                setRecording(false);
                setRefusal(null);
            }}
            className={clsx(
                'inline-flex items-center rounded-lg border bg-clip-padding px-1.5 text-xs disabled:opacity-50',
                size === 'sm' ? 'min-h-7' : 'min-h-8',
                recording ? 'border-accent bg-surface-sunken' : 'border-transparent not-disabled:hover:bg-surface-hover',
                className
            )}
        >
            {recording ? (
                <span aria-live="polite" className={refusal === null ? 'text-text-muted' : 'text-status-error'}>
                    {refusal ?? labels.prompt ?? t('shortcutInput.prompt')}
                </span>
            ) : (
                <Keys shortcut={value} size={size} />
            )}
        </button>
    );
}
