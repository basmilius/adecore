import { Fragment, memo, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { ButtonGroup, IconButton } from '@adecore/ui';
import type { BundledLanguage, BundledTheme, createHighlighter, ThemeRegistration } from 'shiki/bundle/web';
import { IncrementalLines, type CodeToken, type Tokenize } from './code-lines';
import { CodeStreamingContext } from './code-streaming';
import { WHOLE_FADE_CLASS } from './rehype-fade';
import { shikiThemeOf, useCodeTheme } from './code-theme';

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;
type GrammarState = ReturnType<Highlighter['getLastGrammarState']>;
// A plain language needs no grammar; shiki draws it in the theme's own foreground.
const PLAIN = 'text';
const COPIED_MS = 1500;

let highlighter: Highlighter | null = null;
let highlighterLoad: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>([PLAIN]);
const languageLoads = new Map<string, Promise<void>>();
const loadedThemes = new Set<string>();
const themeLoads = new Map<string, Promise<void>>();
const tokenizers = new Map<string, { tokenize: Tokenize<GrammarState>; fg: string | undefined }>();

// Shiki loads on the first code block, not with the app; the web bundle covers the languages a coding agent writes.
function loadHighlighter(): Promise<Highlighter> {
    highlighterLoad ??= import('shiki/bundle/web').then(async ({ createHighlighter }) => {
        highlighter = await createHighlighter({ themes: [], langs: [] });
        return highlighter;
    });
    return highlighterLoad;
}

function resolveLanguage(lang: string, known: Record<string, unknown> | null): string {
    return known !== null && lang in known ? lang : PLAIN;
}

let bundled: Record<string, unknown> | null = null;

/* Loads the highlighter and the grammar of one language, once each. */
function loadLanguage(lang: string): Promise<void> {
    let load = languageLoads.get(lang);
    if (!load) {
        load = Promise.all([loadHighlighter(), import('shiki/bundle/web')]).then(async ([loaded, { bundledLanguages }]) => {
            bundled = bundledLanguages;
            const language = resolveLanguage(lang, bundledLanguages);
            if (!loadedLanguages.has(language)) {
                await loaded.loadLanguage(language as BundledLanguage);
                loadedLanguages.add(language);
            }
        });
        languageLoads.set(lang, load);
    }
    return load;
}

/* Loads a theme into the highlighter, once. */
function loadTheme(theme: string): Promise<void> {
    let load = themeLoads.get(theme);
    if (!load) {
        load = loadHighlighter().then(async (loaded) => {
            await loaded.loadTheme(shikiThemeOf(theme) as BundledTheme | ThemeRegistration);
            loadedThemes.add(theme);
        });
        themeLoads.set(theme, load);
    }
    return load;
}

/* The tokenizer for a language in a theme, or null while shiki, the grammar or the theme is still on its way. */
function tokenizerFor(lang: string, theme: string): { tokenize: Tokenize<GrammarState>; fg: string | undefined } | null {
    if (highlighter === null || bundled === null || !languageLoads.has(lang) || !loadedThemes.has(theme)) {
        return null;
    }
    const language = resolveLanguage(lang, bundled);
    if (!loadedLanguages.has(language)) {
        return null;
    }
    const key = `${language}:${theme}`;
    let entry = tokenizers.get(key);
    if (!entry) {
        const loaded = highlighter;
        const options = { lang: language as BundledLanguage, theme };
        entry = {
            tokenize: (code, state) => {
                const result = loaded.codeToTokens(code, state ? { ...options, grammarState: state } : options);
                return { lines: result.tokens, state: result.grammarState };
            },
            fg: loaded.getTheme(theme).fg
        };
        tokenizers.set(key, entry);
    }
    return entry;
}

function styleOf(token: CodeToken): CSSProperties | undefined {
    const style = token.fontStyle ?? 0;
    if (token.color === undefined && style <= 0) {
        return undefined;
    }
    const decorations = [style & 4 ? 'underline' : '', style & 8 ? 'line-through' : ''].filter(Boolean).join(' ');
    return {
        color: token.color,
        ...(style & 1 ? { fontStyle: 'italic' } : {}),
        ...(style & 2 ? { fontWeight: 'bold' } : {}),
        ...(decorations ? { textDecoration: decorations } : {})
    };
}

/* A line whose tokens did not change keeps its elements, so a selection in it survives the next delta. */
const CodeLine = memo(function CodeLine({ tokens }: { tokens: CodeToken[] }) {
    return (
        <span className="line">
            {tokens.map((token, index) => (
                <span key={index} style={styleOf(token)}>
                    {token.content}
                </span>
            ))}
        </span>
    );
});

/*
 * A fenced block, highlighted a line at a time. Until shiki and the grammar are there it holds its
 * place invisibly, so bare code never turns colored. An open fence is tokenized as it grows, and
 * closing it does not draw it again.
 */
export function CodeBlock({ code, lang, actions }: { code: string; lang: string; actions?: ReactNode }) {
    const { t } = useTranslation('agent-chat');
    const theme = useCodeTheme();
    const streaming = useContext(CodeStreamingContext);
    const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
    const copying = useRef(false);
    // What loaded last, so a block whose theme changes draws again once the new one is in.
    const [loaded, setLoaded] = useState<string | null>(null);
    const tokenizer = tokenizerFor(lang, theme);
    // Only a block that had to wait fades in; one drawn highlighted from its first frame just stands there.
    const [waited] = useState(tokenizer === null);
    const lines = useMemo(() => (tokenizer ? new IncrementalLines(tokenizer.tokenize) : null), [tokenizer]);
    const tokens = useMemo(() => lines?.update(code, !streaming) ?? null, [lines, code, streaming]);

    useEffect(() => {
        if (copyState !== 'copied') {
            return;
        }
        const timer = setTimeout(() => setCopyState('idle'), COPIED_MS);
        return () => clearTimeout(timer);
    }, [copyState]);

    async function copy(): Promise<void> {
        if (copying.current) {
            return;
        }
        copying.current = true;
        setCopyState('copying');
        try {
            // The best-effort clipboard helper cannot distinguish a refusal from success.
            await navigator.clipboard.writeText(code);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        } finally {
            copying.current = false;
        }
    }

    useEffect(() => {
        if (tokenizer !== null) {
            return;
        }
        let cancelled = false;
        Promise.all([loadLanguage(lang), loadTheme(theme)])
            .then(() => !cancelled && setLoaded(`${lang}:${theme}`))
            .catch(() => !cancelled && setLoaded('failed'));
        return () => {
            cancelled = true;
        };
    }, [lang, theme, tokenizer]);

    const pending = (tokenizer === null || tokens === null) && loaded !== 'failed';
    return (
        <div className="chat-code" data-copy-state={copyState}>
            <pre
                className={clsx(pending && 'invisible', !pending && tokens !== null && waited && WHOLE_FADE_CLASS)}
                aria-hidden={pending || undefined}
                style={{ color: tokenizer?.fg }}
            >
                <code>
                    {tokens === null
                        ? code
                        : tokens.map((line, index) => (
                              // Lines only ever grow at the end, so the place of a line is a stable key.
                              <Fragment key={index}>
                                  <CodeLine tokens={line} />
                                  {index < tokens.length - 1 && '\n'}
                              </Fragment>
                          ))}
                </code>
            </pre>
            <ButtonGroup className="chat-code-actions" role="group" aria-label={t('code.actions')}>
                <IconButton
                    icon={copyState === 'copied' ? Check : Copy}
                    size="sm"
                    label={copyState === 'copied' ? t('timeline.actions.copied') : t('timeline.menu.copyCode')}
                    busy={copyState === 'copying'}
                    aria-busy={copyState === 'copying'}
                    aria-disabled={copyState === 'copying'}
                    onClick={() => void copy()}
                />
                {actions}
            </ButtonGroup>
            <span className="sr-only" role="status">
                {copyState === 'copied' ? t('timeline.actions.copied') : ''}
            </span>
            {copyState === 'failed' && (
                <p className="chat-code-error" role="alert">
                    {t('code.copyFailed')}
                </p>
            )}
        </div>
    );
}
