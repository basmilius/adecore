import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createSmartEditorEngine } from '@adecore/editor';
import { EditorLanguage, LanguagePopups, ProjectLanguage, createHolder } from '@adecore/editor-react';
import { FakeLanguageService } from '@adecore/editor-react/testing';
import en from '@adecore/editor-react/locales/en.json';

export default function LanguageEditorExample() {
    const element = useRef<HTMLDivElement>(null);
    const holder = useMemo(() => createHolder<EditorLanguage>(), []);
    const translations = useMemo(() => createInstance(), []);
    const language = useSyncExternalStore(holder.subscribe, holder.get, holder.get);

    useLayoutEffect(() => {
        const host = element.current;
        if (host === null) {
            return;
        }
        void translations.use(initReactI18next).init({ lng: 'en', initAsync: false, resources: { en: { editor: en } }, interpolation: { escapeValue: false } });
        const service = new FakeLanguageService();
        service.respond('textDocument/completion', () => [
            { label: 'greeting', insertText: 'greeting', kind: 6 },
            { label: 'log', insertText: 'console.log(${1:greeting});$0', insertTextFormat: 2, kind: 15 }
        ]);
        service.respond('textDocument/hover', () => ({
            contents: { kind: 'markdown', value: '**greeting**: a sample string.\n\nThis response comes from the injected language service.' }
        }));
        const project = new ProjectLanguage(service);
        const engine = createSmartEditorEngine({ tokenizer: async () => null });
        const editor = engine.mount(host, { text: 'const greeting = "Hello";\nconsole.log(greeting);\n', language: 'typescript', theme: 'github-light' });
        const attached = new EditorLanguage(project, editor, 'file:///example.ts', 'typescript');
        holder.set(attached);
        return () => {
            holder.set(null);
            attached.dispose();
            editor.dispose();
            project.dispose();
        };
    }, [holder, translations]);

    return (
        <I18nextProvider i18n={translations}>
            <div style={{ position: 'relative', height: 260, width: '100%', minWidth: 0 }}>
                <div ref={element} style={{ position: 'absolute', inset: 0 }} />
                {language !== null && <LanguagePopups language={language} />}
            </div>
        </I18nextProvider>
    );
}
