import i18next from 'i18next';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createSmartEditorEngine, type Editor, type EditorOptions, type LineToken, type TokenizedLine, type TokenizerSource } from '@adecore/editor';
import { ProjectLanguage, type EditorLanguage, type ProjectFiles } from '@adecore/editor-react';
import { FakeLanguageService } from '@adecore/editor-react/testing';
import editorWords from '@adecore/editor-react/locales/en.json';
import { i18n } from './i18n.ts';

// The cards read the words through the provider's instance, the features through the global one, so both get them.
i18n.addResourceBundle('en', 'editor', editorWords, true, true);
if (i18next.isInitialized) {
    i18next.addResourceBundle('en', 'editor', editorWords, true, true);
} else {
    void i18next.init({ lng: 'en', fallbackLng: 'en', initAsync: false, interpolation: { escapeValue: false }, resources: { en: { editor: editorWords } } });
}

const KEYWORDS = new Set(
    'as async await break case class const continue default else export extends for from function if import in interface let new of return switch throw type while'.split(
        ' '
    )
);
const TOKEN = /(\/\/.*)|(\/\*)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\d_.]*)|([A-Za-z_$][\w$]*)/g;
const ITALIC = 1;

/* A small TypeScript grammar for the demos, in the theme's colors. An app hands the engine Shiki instead. */
function tokenizeLine(text: string, state: unknown): TokenizedLine {
    const tokens: LineToken[] = [];
    let inComment = state === true;
    let at = 0;
    const push = (end: number, color: string, fontStyle = 0): void => {
        if (end > at) {
            tokens.push({ length: end - at, color, fontStyle });
            at = end;
        }
    };
    while (at < text.length) {
        if (inComment) {
            const close = text.indexOf('*/', at);
            push(close < 0 ? text.length : close + 2, 'var(--text-faint)', ITALIC);
            inComment = close < 0;
            continue;
        }
        TOKEN.lastIndex = at;
        const match = TOKEN.exec(text);
        if (match === null) {
            push(text.length, '');
            break;
        }
        push(match.index, '');
        const end = match.index + match[0].length;
        if (match[1] !== undefined) {
            push(end, 'var(--text-faint)', ITALIC);
        } else if (match[2] !== undefined) {
            inComment = true;
            push(end, 'var(--text-faint)', ITALIC);
        } else if (match[3] !== undefined) {
            push(end, 'var(--status-idle)');
        } else if (match[4] !== undefined) {
            push(end, 'var(--status-needs-you)');
        } else {
            push(end, KEYWORDS.has(match[0]) ? 'var(--accent)' : '');
        }
    }
    return { tokens, state: inComment };
}

export const demoTokenizer: TokenizerSource = async (language) =>
    language === 'typescript' ? { tokenizeLine, sameState: (left, right) => left === right } : null;

export const demoEngine = createSmartEditorEngine({ tokenizer: demoTokenizer });

export const SAMPLE = `import { formatNumber } from './format';

/** The total of every line of an order. */
export function orderTotal(lines: OrderLine[]): number {
    let total = 0;
    for (const line of lines) {
        total += line.price * line.quantity;
    }
    return total;
}

export function describeOrder(lines: OrderLine[]): string {
    const total = orderTotal(lines);
    return \`\${lines.length} lines, \${formatNumber(total)} in total\`;
}
`;

/*
 * Mounts an editor into the returned element after the first render. `options` and `setup` must keep their
 * identity, a module constant or a callback, since a new one mounts the editor again.
 */
export function useEditor(
    options: EditorOptions,
    setup?: (editor: Editor) => void | (() => void)
): { host: RefObject<HTMLDivElement | null>; editor: Editor | null } {
    const host = useRef<HTMLDivElement>(null);
    const [editor, setEditor] = useState<Editor | null>(null);

    useEffect(() => {
        const element = host.current;
        if (element === null) {
            return;
        }
        const mounted = demoEngine.mount(element, options);
        const cleanup = setup?.(mounted);
        setEditor(mounted);
        return () => {
            setEditor(null);
            cleanup?.();
            mounted.dispose();
        };
    }, [options, setup]);

    return { host, editor };
}

export const FORMAT_SOURCE = `export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en').format(value);
}
`;

/* The other file of the demo project, read for a peek; nothing is ever written. */
const demoFiles: ProjectFiles = {
    read: async (path) => (path === '/shop/src/format.ts' ? { text: FORMAT_SOURCE, mtime: 0 } : null),
    stage: () => {},
    save: async () => 'The demo saves nothing.',
    rename: async () => 'The demo moves no files.'
};

/*
 * A project over a fake language service that answers what `configure` registers, as a real server would.
 * It lives as long as the demo, and `language` is the editor's once `onMount` has run.
 */
export function useDemoLanguage(configure: (service: FakeLanguageService) => void) {
    const [project] = useState(() => {
        const service = new FakeLanguageService();
        configure(service);
        return { service, language: new ProjectLanguage(service, { folder: '/shop', files: demoFiles }) };
    });
    const [language, setLanguage] = useState<EditorLanguage | null>(null);
    const onMount = useCallback((_editor: Editor, attached: EditorLanguage | null) => {
        setLanguage(attached);
        return () => setLanguage(null);
    }, []);

    useEffect(() => () => project.language.dispose(), [project]);

    return { service: project.service, project: project.language, language, onMount };
}

export const DEMO_URI = 'file:///shop/src/order.ts';

export const DEMO_OPTIONS: EditorOptions = { text: SAMPLE, language: 'typescript', path: '/shop/src/order.ts', theme: 'demo' };
