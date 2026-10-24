import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorRect } from '@adecore/editor';
import { Input } from '@adecore/ui';
import { AnchoredPopup } from './AnchoredPopup.tsx';
import type { EditorLanguage } from './editor-language.ts';
import type { WrapView } from './popups.ts';

/* The field for the abbreviation a selection is wrapped in: Enter wraps, Escape or leaving the field cancels. */
export function WrapCard({ language, view, rect }: { language: EditorLanguage; view: WrapView; rect: EditorRect }) {
    const { t } = useTranslation('editor');
    const input = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState('');

    useLayoutEffect(() => {
        input.current?.focus();
    }, []);

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.nativeEvent.isComposing) {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            language.markup.cancelWrap();
            language.editor.focus();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (value.trim() !== '') {
                language.markup.submitWrap(value);
            }
        }
    }

    return (
        <AnchoredPopup rect={rect} placement={{ prefer: 'above' }}>
            <div className="flex w-[280px] flex-col gap-1.5 p-2">
                <Input
                    ref={input}
                    size="sm"
                    mono
                    value={value}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label={t('language.markup.wrap')}
                    aria-invalid={view.error !== null}
                    placeholder={t('language.markup.placeholder')}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={() => language.markup.cancelWrap()}
                />
                {view.error !== null ? (
                    <div role="alert" className="text-xs text-status-error">
                        {view.error}
                    </div>
                ) : (
                    <div className="text-xs text-text-muted">↵ {t('language.markup.apply')}</div>
                )}
            </div>
        </AnchoredPopup>
    );
}
