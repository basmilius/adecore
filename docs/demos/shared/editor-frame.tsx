import type { ReactNode, RefObject } from 'react';
import type { Editor, EditorOptions } from '@adecore/editor';
import { EditorView, type EditorLanguage, type ProjectLanguage } from '@adecore/editor-react';
import { DEMO_OPTIONS, DEMO_URI, demoEngine } from './editor.ts';

/* The sized, positioned box an editor needs, with room for controls above it. */
export function EditorFrame({ host, toolbar, className = 'h-72' }: { host: RefObject<HTMLDivElement | null>; toolbar?: ReactNode; className?: string }) {
    return (
        <div className="flex w-full flex-col overflow-hidden rounded-lg border border-border">
            {toolbar !== undefined && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-2 py-1.5">{toolbar}</div>}
            <div className={`relative w-full ${className}`}>
                <div ref={host} className="absolute inset-0" />
            </div>
        </div>
    );
}

/* An `EditorView` on the demo file of a project, under a row of controls. */
export function LanguageFrame({
    project,
    onMount,
    toolbar,
    options = DEMO_OPTIONS,
    className = 'h-72'
}: {
    project: ProjectLanguage;
    onMount(editor: Editor, language: EditorLanguage | null): void | (() => void);
    toolbar?: ReactNode;
    options?: EditorOptions;
    className?: string;
}) {
    return (
        <div className="flex w-full flex-col overflow-hidden rounded-lg border border-border">
            {toolbar !== undefined && <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-2 py-1.5">{toolbar}</div>}
            <EditorView
                engine={demoEngine}
                options={options}
                project={project}
                uri={DEMO_URI}
                languageId="typescript"
                onMount={onMount}
                className={`w-full ${className}`}
            />
        </div>
    );
}
