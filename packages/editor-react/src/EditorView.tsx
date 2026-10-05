import { createHolder } from './holder.ts';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore, type Ref } from 'react';
import type { Editor, EditorEngine, EditorOptions } from '@adecore/editor';
import { EditorLanguage } from './editor-language.ts';
import { LanguagePopups } from './LanguagePopups.tsx';
import type { ProjectLanguage } from './project-language.ts';

export interface EditorViewProps {
    engine: EditorEngine;
    options: EditorOptions;
    project?: ProjectLanguage;
    uri?: string;
    languageId?: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
    onMount?(editor: Editor, language: EditorLanguage | null): void | (() => void);
}

export function EditorView({ engine, options, project, uri, languageId, className, ref, onMount }: EditorViewProps) {
    const element = useRef<HTMLDivElement>(null);
    const holder = useMemo(() => createHolder<EditorLanguage>(), []);
    const language = useSyncExternalStore(holder.subscribe, holder.get, holder.get);
    useLayoutEffect(() => {
        const host = element.current;
        if (host === null) {
            return;
        }
        const editor = engine.mount(host, options);
        const attached = project === undefined || uri === undefined || languageId === undefined ? null : new EditorLanguage(project, editor, uri, languageId);
        holder.set(attached);
        const stop = onMount?.(editor, attached);
        return () => {
            holder.set(null);
            stop?.();
            attached?.dispose();
            editor.dispose();
        };
    }, [engine, options, project, uri, languageId, holder, onMount]);
    return (
        <div className={className} ref={ref} style={{ position: 'relative', minHeight: 0 }}>
            <div ref={element} style={{ position: 'absolute', inset: 0 }} />
            {language !== null && <LanguagePopups language={language} />}
        </div>
    );
}
