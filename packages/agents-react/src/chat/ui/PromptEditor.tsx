import { useLayoutEffect, useRef, type SetStateAction } from 'react';
import clsx from 'clsx';
import { Surface } from '@adecore/ui';
import type { ChatSkill } from '@adecore/agent-contracts';
import type { Referables } from '../chat-references';
import { ComposerInput, type ComposerInputHandle } from './ComposerInput';
import { chipDecorations } from './composer/chips';
import { ComposerMenu } from './composer/ComposerMenu';
import { pickInMenu } from './composer/key-handler';
import { usePromptMenus, type PromptDraft } from './composer/use-prompt-menus';

interface PromptEditorProps {
    value: PromptDraft;
    onChange(next: PromptDraft): void;
    /* The editor's accessible name; a label element cannot point at the editable element. */
    label: string;
    placeholder: string;
    skills: readonly ChatSkill[];
    /* What the CLI answers after `/`, besides `/goal` where `goals` is set. */
    slashCommands?: readonly string[];
    goals?: boolean;
    /* Where `@` searches for files; null offers none. */
    cwd: string | null;
    referables: Referables;
    providerName?: string;
    disabled?: boolean;
    className?: string;
}

const NO_COMMANDS: readonly string[] = [];

/*
 * A prompt written now and sent later, as a form field: the composer's editor with its pickers and chips,
 * without a chat behind it. The host hands in what the CLI it goes to has, and keeps what was picked.
 */
export function PromptEditor({
    value,
    onChange,
    label,
    placeholder,
    skills,
    slashCommands = NO_COMMANDS,
    goals = false,
    cwd,
    referables,
    providerName,
    disabled = false,
    className
}: PromptEditorProps) {
    const inputRef = useRef<ComposerInputHandle>(null);
    // A pick writes twice in one event (the text, then what it picked), and the second must build on the first.
    const latest = useRef(value);

    useLayoutEffect(() => {
        latest.current = value;
    }, [value]);

    const setDraft = (action: SetStateAction<PromptDraft>): void => {
        const next = typeof action === 'function' ? action(latest.current) : action;
        latest.current = next;
        onChange(next);
    };

    const setText = (next: string, mentions = value.mentions, chosen = value.skills): void => {
        setDraft((current) => ({ ...current, text: next, mentions, skills: chosen }));
    };

    const menus = usePromptMenus({
        draft: { draft: value, setDraft, setText },
        inputRef,
        cwd,
        skills,
        slashCommands,
        goals,
        providerName,
        referables,
        label
    });
    const extensions = chipDecorations({ mentions: value.mentions, skills: value.skills, references: menus.referenceChips });

    const onKeyDown = (e: KeyboardEvent): boolean => {
        if (e.isComposing) {
            return false;
        }
        // Escape closes the picker, and only that: the dialog around the field stays.
        if (e.key === 'Escape' && menus.menuOpen) {
            menus.close();
            e.stopPropagation();
            return true;
        }
        // Enter adds a line here rather than sending, so on a command it completes like Tab.
        if (e.key === 'Enter' && menus.commandMenuOpen) {
            menus.completeCommand(menus.commands[menus.activeIndex]!);
            return true;
        }
        return pickInMenu(e, menus);
    };

    return (
        <div className={clsx('relative', className)}>
            {/* Over the form under the field, not inside it, so what a person types never moves while the picker opens and closes. */}
            {menus.menuOpen && (
                <Surface className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg bg-clip-padding *:border-b-0">
                    <ComposerMenu menus={menus} />
                </Surface>
            )}
            <div className="field h-auto overflow-hidden p-0 focus-ring-within">
                <ComposerInput
                    ref={inputRef}
                    dictationToolbar={null}
                    className="composer-input prompt-editor select-text text-sm leading-normal text-text"
                    value={value.text}
                    placeholder={placeholder}
                    disabled={disabled}
                    tabbable
                    extensions={extensions}
                    aria={menus.inputAria}
                    onChange={(text, selection, state) => {
                        setText(text);
                        menus.setMenuIndex(0);
                        menus.trackTriggers(text, selection, state);
                    }}
                    onSelectionChange={menus.trackTriggers}
                    onBlur={menus.close}
                    onKeyDown={onKeyDown}
                />
            </div>
        </div>
    );
}
