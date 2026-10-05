import { useEffect, useRef, type KeyboardEvent, type Ref } from 'react';
import { isApplePlatform, matchesShortcut, TextArea } from '@adecore/ui';
import { applyEdit, indentEdit, newlineEdit, outdentEdit, type TextEdit } from './editing.ts';
import { RUN_ALL_SHORTCUT, RUN_SHORTCUT } from './shortcuts.ts';

/* What the person asked for: the selection or the statement under the caret, or the whole script. */
export type RunScope = 'selection-or-statement' | 'all';

export interface SqlEditorProps {
    value: string;
    onValueChange(value: string): void;
    /* Mod+Enter and Mod+Shift+Enter. */
    onRun(scope: RunScope): void;
    label: string;
    placeholder?: string;
    className?: string;
    /* The text area, which holds the selection and the caret the console reads when it runs. */
    ref?: Ref<HTMLTextAreaElement>;
}

/*
 * Where the SQL is typed. A plain text area for now, kept to itself so an editor with highlighting
 * and completion can take its place without the console noticing: it needs only these props.
 */
export function SqlEditor({ value, onValueChange, onRun, label, placeholder, className, ref }: SqlEditorProps) {
    const pendingSelection = useRef<{ area: HTMLTextAreaElement; start: number; end: number } | null>(null);

    useEffect(() => {
        const pending = pendingSelection.current;
        if (pending !== null) {
            pendingSelection.current = null;
            pending.area.setSelectionRange(pending.start, pending.end);
        }
    }, [value]);

    // Through the browser's own insert, so Cmd+Z undoes the edit; the fallback sets the value itself.
    const apply = (area: HTMLTextAreaElement, edit: TextEdit): void => {
        const before = area.value;
        area.setSelectionRange(edit.from, edit.to);
        const inserted = document.execCommand('insertText', false, edit.insert);
        if (inserted && area.value === applyEdit(before, edit)) {
            area.setSelectionRange(edit.selectionStart, edit.selectionEnd);
            return;
        }
        pendingSelection.current = { area, start: edit.selectionStart, end: edit.selectionEnd };
        onValueChange(applyEdit(before, edit));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
        const apple = isApplePlatform();
        if (matchesShortcut(RUN_ALL_SHORTCUT, event, apple)) {
            event.preventDefault();
            onRun('all');
            return;
        }
        if (matchesShortcut(RUN_SHORTCUT, event, apple)) {
            event.preventDefault();
            onRun('selection-or-statement');
            return;
        }
        if (event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }
        const area = event.currentTarget;
        const { selectionStart, selectionEnd } = area;
        if (event.key === 'Tab') {
            event.preventDefault();
            const edit = event.shiftKey ? outdentEdit(area.value, selectionStart, selectionEnd) : indentEdit(area.value, selectionStart, selectionEnd);
            if (edit !== null) {
                apply(area, edit);
            }
        } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            apply(area, newlineEdit(area.value, selectionStart, selectionEnd));
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
