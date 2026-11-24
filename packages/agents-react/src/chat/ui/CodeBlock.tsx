import { ButtonGroup, IconButton, ScrollArea } from '@adecore/ui';
import clsx from 'clsx';
import { Check, Copy } from 'lucide-react';
import { Fragment, memo, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatHost } from '../../host/host';
import { IncrementalLines, type CodeToken } from './code-lines';
import { CodeStreamingContext } from './code-streaming';
import { useCodeTheme } from './code-theme';
import { tokenStyle, useCodeHighlighter } from './highlighter';
import { WHOLE_FADE_CLASS } from './rehype-fade';

const COPIED_MS = 1500;

/* Which lines of a block are numbered and marked. */
export interface CodeBlockLines {
    /* The number of the first line. With it every line shows its number. */
    start?: number;

    /* The numbers of the lines to mark, counted from `start`, or from 1 without it. */
    marked?: readonly number[];
}

/* A line whose tokens did not change keeps its elements, so a selection in it survives the next delta. A line not highlighted yet is its text. */
const CodeLine = memo(function CodeLine({ tokens, number, marked }: { tokens: CodeToken[] | string; number?: number; marked?: boolean }) {
    return (
        <span className="line" data-line={number} data-marked={marked ? '' : undefined}>
            {typeof tokens === 'string'
                ? tokens
                : tokens.map((token, index) => (
                      <span key={index} style={tokenStyle(token)}>
                          {token.content}
                      </span>
                  ))}
        </span>
    );
});

/*
 * A fenced block, highlighted a line at a time. Until shiki and the grammar are there it holds its
 * place invisibly, so bare code never turns colored. An open fence is tokenized as it grows, and
 * closing it does not draw it again. `view` takes the place of the code, such as what the code draws,
 * and Copy still copies the code. `lines` numbers and marks lines; a number is never part of a selection.
 */
export function CodeBlock({ code, lang, actions, view, lines }: { code: string; lang: string; actions?: ReactNode; view?: ReactNode; lines?: CodeBlockLines }) {
    const { t } = useTranslation('agent-chat');
    const theme = useCodeTheme();
    const { custom } = useChatHost().code;
    const highlighter = useCodeHighlighter();
    const streaming = useContext(CodeStreamingContext);
    const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
    const copying = useRef(false);
    // What loaded last, so a block whose theme changes draws again once the new one is in.
    const [loaded, setLoaded] = useState<string | null>(null);
    const tokenizer = highlighter.tokenizer(lang, theme);
    // Only a block that had to wait fades in; one drawn highlighted from its first frame just stands there.
    const [waited] = useState(tokenizer === null);
    const incremental = useMemo(() => (tokenizer ? new IncrementalLines(tokenizer.tokenize) : null), [tokenizer]);
    const tokens = useMemo(() => incremental?.update(code, !streaming) ?? null, [incremental, code, streaming]);

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

        Promise.all([highlighter.loadLanguage(lang), highlighter.loadTheme(theme, custom)])
            .then(() => !cancelled && setLoaded(`${lang}:${theme}`))
            .catch(() => !cancelled && setLoaded('failed'));

        return () => {
            cancelled = true;
        };
    }, [highlighter, lang, theme, custom, tokenizer]);

    const pending = (tokenizer === null || tokens === null) && loaded !== 'failed';
    // Numbered or marked code is drawn a line at a time before it is highlighted too, so a line never changes its box.
    const drawn: readonly (CodeToken[] | string)[] | null = tokens ?? (lines === undefined ? null : code.split('\n'));
    const first = lines?.start ?? 1;
    const digits = lines?.start === undefined || drawn === null ? undefined : String(first + drawn.length - 1).length;

    return (
        <div className="chat-code" data-copy-state={copyState}>
            {view ?? (
                <ScrollArea
                    axis="both"
                    render={<pre />}
                    viewportClassName={clsx(pending && 'invisible', !pending && tokens !== null && waited && WHOLE_FADE_CLASS)}
                    aria-hidden={pending || undefined}
                    data-lined={lines === undefined ? undefined : ''}
                    style={{ color: tokenizer?.fg, '--chat-code-digits': digits } as CSSProperties}
                >
                    <code>
                        {drawn === null
                            ? code
                            : drawn.map((line, index) => (
                                  // Lines only ever grow at the end, so the place of a line is a stable key.
                                  <Fragment key={index}>
                                      <CodeLine
                                          tokens={line}
                                          number={lines?.start === undefined ? undefined : first + index}
                                          marked={lines?.marked?.includes(first + index)}
                                      />
                                      {index < drawn.length - 1 && '\n'}
                                  </Fragment>
                              ))}
                    </code>
                </ScrollArea>
            )}
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
